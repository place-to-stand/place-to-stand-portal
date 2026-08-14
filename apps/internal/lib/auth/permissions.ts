import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  projects,
  taskComments,
  taskAttachments,
  tasks,
  timeLogTasks,
  timeLogs,
} from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

type UUID = string

export function isAdmin(user: AppUser | null | undefined): boolean {
  return !!user && user.role === 'ADMIN'
}

export function assertAdmin(user: AppUser) {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Admin privileges required')
  }
}

/**
 * The internal portal is admin-only (CLIENT users are redirected to the
 * client portal at sign-in), so these guards assert the admin role and then
 * verify the target entity exists and is not soft-deleted.
 */
export async function ensureProjectAccess(user: AppUser, projectId: UUID) {
  assertAdmin(user)

  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project.length) {
    throw new NotFoundError('Project not found')
  }
}

export async function ensureTaskAccess(
  user: AppUser,
  taskId: UUID,
  options: { includeArchived?: boolean } = {}
) {
  const { includeArchived = false } = options

  const whereClause = includeArchived
    ? eq(tasks.id, taskId)
    : and(eq(tasks.id, taskId), isNull(tasks.deletedAt))

  const task = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(whereClause)
    .limit(1)

  if (!task.length) {
    throw new NotFoundError('Task not found')
  }

  const projectId = task[0].projectId

  // A lead-anchored task has no project to authorize against (PRD 005 D8).
  // The internal portal is admin-only and `assertAdmin` already ran above, so
  // existence is the remaining check — which the lookup just performed.
  if (projectId === null) {
    return
  }

  await ensureProjectAccess(user, projectId)
}

export async function ensureTaskCommentAccess(
  user: AppUser,
  taskCommentId: UUID
) {
  const comment = await db
    .select({ id: taskComments.id, taskId: taskComments.taskId })
    .from(taskComments)
    .where(
      and(eq(taskComments.id, taskCommentId), isNull(taskComments.deletedAt))
    )
    .limit(1)

  if (!comment.length) {
    throw new NotFoundError('Task comment not found')
  }

  await ensureTaskAccess(user, comment[0].taskId)
}

export async function ensureTimeLogAccess(user: AppUser, timeLogId: UUID) {
  const timeLog = await db
    .select({
      id: timeLogs.id,
      projectId: timeLogs.projectId,
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.id, timeLogId), isNull(timeLogs.deletedAt)))
    .limit(1)

  if (!timeLog.length) {
    throw new NotFoundError('Time log not found')
  }

  await ensureProjectAccess(user, timeLog[0].projectId)
}

export async function ensureTimeLogTaskAccess(
  user: AppUser,
  timeLogTaskId: UUID
) {
  const timeLogTask = await db
    .select({
      id: timeLogTasks.id,
      timeLogId: timeLogTasks.timeLogId,
    })
    .from(timeLogTasks)
    .where(
      and(eq(timeLogTasks.id, timeLogTaskId), isNull(timeLogTasks.deletedAt))
    )
    .limit(1)

  if (!timeLogTask.length) {
    throw new NotFoundError('Time log task not found')
  }

  await ensureTimeLogAccess(user, timeLogTask[0].timeLogId)
}

export async function ensureTaskAttachmentAccess(
  user: AppUser,
  attachmentId: UUID
) {
  const attachment = await db
    .select({
      id: taskAttachments.id,
      taskId: taskAttachments.taskId,
    })
    .from(taskAttachments)
    .where(
      and(
        eq(taskAttachments.id, attachmentId),
        isNull(taskAttachments.deletedAt)
      )
    )
    .limit(1)

  if (!attachment.length) {
    throw new NotFoundError('Task attachment not found')
  }

  await ensureTaskAccess(user, attachment[0].taskId)
}
