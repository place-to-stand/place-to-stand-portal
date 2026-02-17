'use server'

import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { ensureClientAccessByTaskId } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { taskDeployments } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import type { DbTaskDeployment } from '@/lib/types'

const fetchSchema = z.object({
  taskId: z.string().uuid(),
})

export type FetchDeploymentsResult =
  | { deployments: DbTaskDeployment[] }
  | { error: string }

/**
 * Fetch all deployments for a task, newest first.
 */
export async function fetchTaskDeployments(input: {
  taskId: string
}): Promise<FetchDeploymentsResult> {
  const user = await requireUser()

  const parsed = fetchSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid payload.' }

  const { taskId } = parsed.data

  try {
    await ensureClientAccessByTaskId(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) return { error: 'Task not found.' }
    if (error instanceof ForbiddenError) return { error: 'Permission denied.' }
    console.error('fetchTaskDeployments auth error', error)
    return { error: 'Unable to authorize request.' }
  }

  const rows = await db
    .select()
    .from(taskDeployments)
    .where(eq(taskDeployments.taskId, taskId))
    .orderBy(desc(taskDeployments.createdAt))

  const deployments: DbTaskDeployment[] = rows.map(r => ({
    id: r.id,
    task_id: r.taskId,
    repo_link_id: r.repoLinkId,
    github_issue_number: r.githubIssueNumber,
    github_issue_url: r.githubIssueUrl,
    worker_status: r.workerStatus,
    pr_url: r.prUrl,
    plan_id: r.planId,
    model: r.model,
    mode: r.mode,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }))

  return { deployments }
}
