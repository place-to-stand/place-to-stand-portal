'use server'

import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import {
  workerPlanRequestedEvent,
  workerImplementRequestedEvent,
} from '@/lib/activity/events'
import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks, projects, taskDeployments } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getRepoLinkById } from '@/lib/data/github-repos'
import {
  createIssue,
  createIssueComment,
} from '@/lib/github/client'
import { composeWorkerComment } from '@/lib/github/compose-worker-comment'
import { composeIssueBody } from '@/lib/github/compose-issue-body'
import { serverEnv } from '@/lib/env.server'

const modelSchema = z.enum(['opus', 'sonnet', 'haiku'])

const deployModeSchema = z.enum(['plan', 'execute'])

const triggerPlanSchema = z.object({
  taskId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  model: modelSchema,
  mode: deployModeSchema.default('plan'),
})

const triggerImplementSchema = z.object({
  deploymentId: z.string().uuid(),
  model: modelSchema,
  customPrompt: z.string().max(4000).optional(),
})

type TriggerResult =
  | { deploymentId: string; issueNumber: number; issueUrl: string; commentUrl: string; workerStatus: 'working' | 'implementing' }
  | { error: string }

type ImplementResult =
  | { commentUrl: string }
  | { error: string }

/**
 * Create a GitHub issue from a task and post a @pts-worker /plan comment.
 */
export async function triggerWorkerPlan(input: {
  taskId: string
  repoLinkId: string
  model: 'opus' | 'sonnet' | 'haiku'
  mode?: 'plan' | 'execute'
}): Promise<TriggerResult> {
  const user = await requireUser()

  const parsed = triggerPlanSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const { taskId, repoLinkId, model, mode } = parsed.data

  // Auth check
  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('triggerWorkerPlan auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  // Load task with project
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) return { error: 'Task not found.' }

  // Load repo link and verify it belongs to the task's project
  const repoLink = await getRepoLinkById(repoLinkId)
  if (!repoLink) return { error: 'Repository link not found.' }
  if (repoLink.projectId !== task.projectId) {
    return { error: 'Repository does not belong to this project.' }
  }

  // Build portal URL for issue body
  const baseUrl =
    serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const portalUrl = baseUrl ? `${baseUrl}/projects` : ''

  // Create GitHub issue
  let issue: { number: number; html_url: string }
  try {
    issue = await createIssue(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      {
        title: `Portal:${task.title}`,
        body: composeIssueBody({
          taskTitle: task.title,
          taskDescription: task.description,
          portalUrl,
        }),
      },
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to create GitHub issue', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to create GitHub issue.',
    }
  }

  const initialStatus = mode === 'execute' ? 'implementing' as const : 'working' as const

  // Insert deployment row
  const [deployment] = await db
    .insert(taskDeployments)
    .values({
      taskId,
      repoLinkId,
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      workerStatus: initialStatus,
      model,
      mode,
      createdBy: user.id,
    })
    .returning()

  // Update task cached fields to point to latest deployment
  await db
    .update(tasks)
    .set({
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      workerStatus: initialStatus,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tasks.id, taskId))

  // Post @pts-worker /plan comment
  let comment: { id: number; html_url: string }
  try {
    const body = composeWorkerComment({
      mode: mode === 'execute' ? 'execute' : 'plan',
      model,
      taskTitle: task.title,
      taskDescription: task.description,
    })
    comment = await createIssueComment(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      issue.number,
      body,
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to post worker comment', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to post worker comment.',
    }
  }

  // Log activity
  const event =
    mode === 'execute'
      ? workerImplementRequestedEvent({
          taskTitle: task.title,
          model,
          repoFullName: repoLink.repoFullName,
          issueNumber: issue.number,
          hasCustomPrompt: false,
        })
      : workerPlanRequestedEvent({
          taskTitle: task.title,
          model,
          repoFullName: repoLink.repoFullName,
          issueNumber: issue.number,
        })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: task.projectId,
    targetClientId: task.clientId ?? null,
    metadata: event.metadata,
  })

  return { deploymentId: deployment.id, issueNumber: issue.number, issueUrl: issue.html_url, commentUrl: comment.html_url, workerStatus: initialStatus }
}

/**
 * Post a @pts-worker implement comment on an existing deployment's GitHub issue.
 */
export async function triggerWorkerImplement(input: {
  deploymentId: string
  model: 'opus' | 'sonnet' | 'haiku'
  customPrompt?: string
}): Promise<ImplementResult> {
  const user = await requireUser()

  const parsed = triggerImplementSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const { deploymentId, model, customPrompt } = parsed.data

  // Load deployment
  const [deployment] = await db
    .select()
    .from(taskDeployments)
    .where(eq(taskDeployments.id, deploymentId))
    .limit(1)

  if (!deployment) return { error: 'Deployment not found.' }

  const taskId = deployment.taskId

  // Auth check
  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('triggerWorkerImplement auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  // Load task for context
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      projectId: tasks.projectId,
      clientId: projects.clientId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (!task) return { error: 'Task not found.' }

  // Load repo link
  const repoLink = await getRepoLinkById(deployment.repoLinkId)
  if (!repoLink) return { error: 'Repository link not found.' }

  // Post implement comment
  let comment: { id: number; html_url: string }
  try {
    const body = composeWorkerComment({
      mode: 'implement',
      model,
      taskTitle: task.title,
      taskDescription: task.description,
      customPrompt,
    })
    comment = await createIssueComment(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      deployment.githubIssueNumber,
      body,
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to post implement comment', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to post implement comment.',
    }
  }

  // Update deployment status
  await db
    .update(taskDeployments)
    .set({
      workerStatus: 'implementing',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(taskDeployments.id, deploymentId))

  // Sync task cached fields if this is the latest deployment
  const [latest] = await db
    .select({ id: taskDeployments.id })
    .from(taskDeployments)
    .where(eq(taskDeployments.taskId, taskId))
    .orderBy(desc(taskDeployments.createdAt))
    .limit(1)

  if (latest && latest.id === deploymentId) {
    await db
      .update(tasks)
      .set({
        workerStatus: 'implementing',
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))
  }

  // Log activity
  const event = workerImplementRequestedEvent({
    taskTitle: task.title,
    model,
    repoFullName: repoLink.repoFullName,
    issueNumber: deployment.githubIssueNumber,
    hasCustomPrompt: Boolean(customPrompt),
  })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: task.projectId,
    targetClientId: task.clientId ?? null,
    metadata: event.metadata,
  })

  return { commentUrl: comment.html_url }
}
