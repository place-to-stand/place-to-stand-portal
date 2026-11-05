import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { projects, tasks, timeLogs } from '@/lib/db/schema'
import { roleCan, type Capability } from '@/lib/auth/capabilities'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

type UUID = string

/** Whether the user's role holds a capability (`lib/auth/capabilities.ts`). */
export function can(
  user: AppUser | null | undefined,
  capability: Capability
): boolean {
  return roleCan(user?.role, capability)
}

/**
 * The guard for code below the page and route layer: throws ForbiddenError
 * unless the user's role holds `capability`.
 */
export function assertCan(user: AppUser, capability: Capability) {
  if (!can(user, capability)) {
    throw new ForbiddenError('You don’t have permission to do that.')
  }
}

/** Admin-only code with no narrower capability yet (`portal.admin`). */
export function assertAdmin(user: AppUser) {
  if (!can(user, 'portal.admin')) {
    throw new ForbiddenError('Admin privileges required')
  }
}

/**
 * CRM access (leads, contacts and their activity): ADMIN or SALES. Only the
 * CRM layer calls this; every other guard stays `assertAdmin`.
 */
export function assertCrmAccess(user: AppUser) {
  if (!can(user, 'leads.manage')) {
    throw new ForbiddenError('CRM access required')
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

  const { projectId } = task[0]
  // A lead task has no project; this guard is admin-only either way.
  if (projectId) {
    await ensureProjectAccess(user, projectId)
  } else {
    assertAdmin(user)
  }
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
