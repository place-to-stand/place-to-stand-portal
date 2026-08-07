import 'server-only'

import { and, asc, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import {
  assertAdmin,
  ensureProjectAccess,
  ensureTaskAccess,
} from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { taskFields, type SelectTask } from './common'

export async function listTasksForProject(
  user: AppUser,
  projectId: string,
): Promise<SelectTask[]> {
  await ensureProjectAccess(user, projectId)

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.rank))
}

export async function listTasksForUser(
  user: AppUser,
): Promise<SelectTask[]> {
  assertAdmin(user)

  return db
    .select(taskFields)
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .orderBy(asc(tasks.rank))
}

export async function getTaskById(
  user: AppUser,
  taskId: string,
): Promise<SelectTask> {
  await ensureTaskAccess(user, taskId)

  const result = await db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Task not found')
  }

  return result[0]
}

/**
 * Get tasks linked to a specific lead.
 * Admin-only operation (leads are admin-only).
 */
export async function listTasksForLead(
  user: AppUser,
  leadId: string,
): Promise<SelectTask[]> {
  assertAdmin(user)

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(eq(tasks.leadId, leadId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.createdAt))
}

export type { SelectTask } from './common'

