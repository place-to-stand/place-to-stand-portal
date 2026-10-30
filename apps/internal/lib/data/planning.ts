import 'server-only'

import { desc, eq } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { taskDeployments } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type {
  PlanRevisionData,
  PlanThreadData,
  PlanningSessionData,
} from '@/lib/planning/types'
import {
  getPlanningContextForThread,
  getRevisions,
  getSessionByTaskId,
  getThreadsForSession,
} from '@/lib/queries/planning'
import type { DbTaskDeployment } from '@/lib/types'

/**
 * Reads behind the task sheet's planning panel. All of them are plain reads:
 * opening the panel must not write, so a task with no session yet comes back
 * as `null` and the panel shows its empty state. The session is created by
 * the first explicit action (`startPlanningThread`).
 */

export function toPlanThreadData(
  thread: Awaited<ReturnType<typeof getThreadsForSession>>[number]
): PlanThreadData {
  return {
    id: thread.id,
    model: thread.model,
    modelLabel: thread.modelLabel,
    currentVersion: thread.currentVersion,
    generationStatus: thread.generationStatus,
    generatingVersion: thread.generatingVersion,
    partialContent: thread.partialContent,
    generationError: thread.generationError,
  }
}

export async function loadPlanningSession(
  user: AppUser,
  taskId: string
): Promise<PlanningSessionData | null> {
  await ensureTaskAccess(user, taskId)

  const session = await getSessionByTaskId(taskId)

  if (!session) {
    return null
  }

  const threads = await getThreadsForSession(session.id)

  return { sessionId: session.id, threads: threads.map(toPlanThreadData) }
}

export async function loadPlanRevisions(
  user: AppUser,
  threadId: string
): Promise<PlanRevisionData[]> {
  const context = await getPlanningContextForThread(threadId)

  if (!context) {
    throw new NotFoundError('Plan not found.')
  }

  await ensureTaskAccess(user, context.taskId)

  const revisions = await getRevisions(threadId)

  return revisions.map(revision => ({
    id: revision.id,
    version: revision.version,
    content: revision.content,
    feedback: revision.feedback,
    createdAt: revision.createdAt,
  }))
}

/** A task's deployments, newest first. */
export async function loadTaskDeployments(
  user: AppUser,
  taskId: string
): Promise<DbTaskDeployment[]> {
  await ensureTaskAccess(user, taskId)

  const rows = await db
    .select()
    .from(taskDeployments)
    .where(eq(taskDeployments.taskId, taskId))
    .orderBy(desc(taskDeployments.createdAt))

  return rows.map(r => ({
    id: r.id,
    task_id: r.taskId,
    repo_link_id: r.repoLinkId,
    github_issue_number: r.githubIssueNumber,
    github_issue_url: r.githubIssueUrl,
    worker_status: r.workerStatus,
    pr_url: r.prUrl,
    plan_id: r.planId,
    plan_thread_id: r.planThreadId,
    plan_version: r.planVersion,
    model: r.model,
    mode: r.mode,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }))
}
