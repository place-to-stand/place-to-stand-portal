import 'server-only'

import { eq, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { taskUpdatedEvent } from '@/lib/activity/events'
import type { AppUser } from '@/lib/auth/session'
import { ensureTaskWorkAccess } from '@/lib/projects/access'
import { db } from '@/lib/db'
import { leads, projects, tasks } from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'

/**
 * Sets or clears a task's due date and nothing else (the card menu's "Set
 * due date" and the board's bulk bar), with the same activity row as a sheet
 * save. `dueOn` is `YYYY-MM-DD` or null; callers validate it and refresh the
 * task views.
 */
export async function setTaskDueDateForActor(
  user: AppUser,
  taskId: string,
  dueOn: string | null
): Promise<{ error?: string }> {
  try {
    await ensureTaskWorkAccess(user, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: 'Task not found.' }
    }

    if (error instanceof ForbiddenError) {
      return { error: 'You do not have permission to update this task.' }
    }

    console.error('Failed to authorize task for due date change', error)
    return { error: 'Unable to update task due date.' }
  }

  const taskRecords = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueOn: tasks.dueOn,
      projectId: tasks.projectId,
      companyId: sql<
        string | null
      >`coalesce(${projects.companyId}, ${leads.companyId})`,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(leads, eq(leads.id, tasks.leadId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const task = taskRecords[0]

  if (!task) {
    return { error: 'Task not found.' }
  }

  const previousDueOn = task.dueOn ?? null
  const nextDueOn = dueOn ?? null

  if (previousDueOn === nextDueOn) {
    return {}
  }

  await db.update(tasks).set({ dueOn: nextDueOn }).where(eq(tasks.id, taskId))

  const event = taskUpdatedEvent({
    title: task.title ?? 'Task',
    changedFields: ['due date'],
    details: {
      before: { dueOn: previousDueOn },
      after: { dueOn: nextDueOn },
    },
  })

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: task.projectId,
    targetCompanyId: task.companyId ?? null,
    metadata: event.metadata,
  })

  return {}
}
