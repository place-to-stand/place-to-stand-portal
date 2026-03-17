'use server'

import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

import { logActivity } from '@/lib/activity/logger'
import {
  workerPlanRequestedEvent,
  workerImplementRequestedEvent,
  workerCancelledEvent,
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
  createCommentReaction,
  listIssueComments,
  getFileContents,
} from '@/lib/github/client'
import { composeWorkerComment } from '@/lib/github/compose-worker-comment'
import { composeIssueBody } from '@/lib/github/compose-issue-body'
import { serverEnv } from '@/lib/env.server'
import { customAlphabet } from 'nanoid'
import { getRevisionByVersion } from '@/lib/queries/planning'

const generatePlanId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)

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
  const planId = `PLN-${generatePlanId()}`

  // Insert deployment row
  const [deployment] = await db
    .insert(taskDeployments)
    .values({
      taskId,
      repoLinkId,
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      workerStatus: initialStatus,
      planId,
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
      planId,
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

// ---------------------------------------------------------------------------
// Cancel Deployment
// ---------------------------------------------------------------------------

const WORKER_BOT_LOGIN = 'pts-worker[bot]'

const cancelSchema = z.object({
  deploymentId: z.string().uuid(),
})

type CancelResult = { ok: true } | { error: string }

/**
 * Cancel an in-progress deployment by reacting 👎 on the latest bot comment.
 */
export async function cancelDeployment(input: {
  deploymentId: string
}): Promise<CancelResult> {
  const user = await requireUser()

  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { deploymentId } = parsed.data

  // Load deployment
  const [deployment] = await db
    .select()
    .from(taskDeployments)
    .where(eq(taskDeployments.id, deploymentId))
    .limit(1)

  if (!deployment) return { error: 'Deployment not found.' }

  // Verify cancellable status
  if (deployment.workerStatus !== 'working' && deployment.workerStatus !== 'implementing') {
    return { error: 'Deployment is not in a cancellable state.' }
  }

  const taskId = deployment.taskId

  // Auth check
  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('cancelDeployment auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  // Load task for context
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
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

  // Find latest bot comment to react on
  let rawComments
  try {
    rawComments = await listIssueComments(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      deployment.githubIssueNumber,
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to fetch issue comments for cancel', error)
    return { error: 'Failed to fetch issue comments.' }
  }

  const botComments = rawComments.filter(c => c.user.login === WORKER_BOT_LOGIN)
  if (botComments.length === 0) {
    return { error: 'No worker comments found to cancel.' }
  }

  const latestBotComment = botComments[botComments.length - 1]

  // React with 👎 (-1) on the latest bot comment
  try {
    await createCommentReaction(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      latestBotComment.id,
      '-1',
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('Failed to add cancel reaction', error)
    return {
      error:
        error instanceof Error
          ? `GitHub API error: ${error.message}`
          : 'Failed to add cancel reaction.',
    }
  }

  // Update deployment status
  await db
    .update(taskDeployments)
    .set({
      workerStatus: 'cancelled',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(taskDeployments.id, deploymentId))

  // Sync task cached status if this is the latest deployment
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
        workerStatus: 'cancelled',
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))
  }

  // Log activity
  const event = workerCancelledEvent({
    taskTitle: task.title,
    repoFullName: repoLink.repoFullName,
    issueNumber: deployment.githubIssueNumber,
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

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Deploy Plan (AI Planning Panel → GitHub issue with PRD instructions)
// ---------------------------------------------------------------------------

const deployPlanSchema = z.object({
  threadId: z.string().uuid(),
  version: z.number().int().min(1),
  taskId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  model: modelSchema,
})

type DeployPlanResult = TriggerResult

/**
 * Deploy a finalized plan from the AI planning panel.
 * Creates a GitHub issue with the plan content + PRD file instructions.
 */
export async function deployPlan(input: {
  threadId: string
  version: number
  taskId: string
  repoLinkId: string
  model: 'opus' | 'sonnet' | 'haiku'
}): Promise<DeployPlanResult> {
  const user = await requireUser()

  const parsed = deployPlanSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { threadId, version, taskId, repoLinkId, model } = parsed.data

  // Auth check
  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    return { error: 'Unable to authorize request.' }
  }

  // Load the plan revision
  const revision = await getRevisionByVersion(threadId, version)
  if (!revision) return { error: 'Plan revision not found.' }

  // Load task
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
  const repoLink = await getRepoLinkById(repoLinkId)
  if (!repoLink) return { error: 'Repository link not found.' }

  // Determine PRD number by reading docs/prds/ directory
  let prdNumber = 1
  try {
    const result = await getFileContents(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      'docs/prds',
      undefined,
      repoLink.oauthConnectionId
    )
    if (result.type === 'dir') {
      // Parse existing folder names like "001-feature-name"
      const numbers = result.entries
        .filter(e => e.type === 'dir')
        .map(e => {
          const match = e.name.match(/^(\d+)-/)
          return match ? parseInt(match[1], 10) : 0
        })
        .filter(n => n > 0)

      if (numbers.length > 0) {
        prdNumber = Math.max(...numbers) + 1
      }
    }
  } catch {
    // Directory doesn't exist — start at 001
  }

  // Generate slug from task title
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  const prdDir = `docs/prds/${String(prdNumber).padStart(3, '0')}-${slug}`
  const prdPath = `${prdDir}/README.md`
  const planId = `PLN-${generatePlanId()}`

  // Build portal URL for issue body
  const baseUrl = serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
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
    console.error('deployPlan: Failed to create GitHub issue', error)
    return {
      error: error instanceof Error
        ? `GitHub API error: ${error.message}`
        : 'Failed to create GitHub issue.',
    }
  }

  // Insert deployment row
  const [deployment] = await db
    .insert(taskDeployments)
    .values({
      taskId,
      repoLinkId,
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      workerStatus: 'working',
      planId,
      planThreadId: threadId,
      planVersion: version,
      model,
      mode: 'plan',
      createdBy: user.id,
    })
    .returning()

  // Update task cached fields
  await db
    .update(tasks)
    .set({
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.html_url,
      workerStatus: 'working',
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tasks.id, taskId))

  // Post worker comment with plan content + PRD instructions
  let comment: { id: number; html_url: string }
  try {
    const workerBody = composePlanDeployComment({
      model,
      planContent: revision.content,
      prdPath,
      planId,
    })
    comment = await createIssueComment(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      issue.number,
      workerBody,
      repoLink.oauthConnectionId
    )
  } catch (error) {
    console.error('deployPlan: Failed to post worker comment', error)
    return {
      error: error instanceof Error
        ? `GitHub API error: ${error.message}`
        : 'Failed to post worker comment.',
    }
  }

  // Log activity
  const event = workerPlanRequestedEvent({
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
    metadata: { ...(event.metadata as Record<string, unknown> ?? {}), planId, prdPath },
  })

  return {
    deploymentId: deployment.id,
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    commentUrl: comment.html_url,
    workerStatus: 'working',
  }
}

/**
 * Compose the worker comment for a plan deployment with PRD instructions.
 */
function composePlanDeployComment(params: {
  model: 'opus' | 'sonnet' | 'haiku'
  planContent: string
  prdPath: string
  planId: string
}): string {
  const { model, planContent, prdPath, planId } = params

  return `@pts-worker /model/${model}

## Implementation Plan

${planContent}

## Documentation

Save this implementation plan as \`${prdPath}\`.
Create the parent directory if it doesn't exist.

---
Plan ID: ${planId}`
}
