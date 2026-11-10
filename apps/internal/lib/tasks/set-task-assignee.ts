import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import type { SetAssigneeResult } from '@/lib/assignees/types'
import { db } from '@/lib/db'
import { leads, projects, taskAssignees, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureTaskWorkAccess,
  findBlockedAssignees,
} from '@/lib/projects/access'
import { notifyTaskAssigned } from '@/lib/notifications/in-app/events'
import type { ActivitySourceValue } from '@/lib/types'

import { assigneeAccessError } from './assignee-access'
import { buildTaskUpdateEvent } from './save-task-activity'
import { syncAssignees } from './save-task-children'

/**
 * Sets or clears a task's one assignee, and nothing else (the right-click
 * menu's "Set assignee"). Same rules, notification and activity row as a
 * sheet save that only changes the assignee.
 */
export async function setTaskAssigneeForActor(
  actor: AppUser,
  taskId: string,
  assigneeId: string | null,
  source: ActivitySourceValue
): Promise<SetAssigneeResult> {
  try {
    await ensureTaskWorkAccess(actor, taskId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { ok: false, error: 'Task not found.' }
    }
    if (error instanceof ForbiddenError) {
      return {
        ok: false,
        error: 'You do not have permission to update this task.',
      }
    }
    console.error('Failed to authorize task assignee change', error)
    return { ok: false, error: 'Unable to update task.' }
  }

  const [task] = await db
    .select({
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      dueOn: tasks.dueOn,
      projectId: tasks.projectId,
      leadId: tasks.leadId,
      companyId: sql<
        string | null
      >`coalesce(${projects.companyId}, ${leads.companyId})`,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(leads, eq(leads.id, tasks.leadId))
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1)

  if (!task) {
    return { ok: false, error: 'Task not found.' }
  }

  const existingAssigneeIds = (
    await db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(
        and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt))
      )
  ).map(row => row.userId)
  const nextAssigneeIds = assigneeId ? [assigneeId] : []

  if (assigneeId) {
    const blocked = await findBlockedAssignees(task.projectId, [assigneeId])
    if (blocked.length) {
      return {
        ok: false,
        error: assigneeAccessError(blocked.map(person => person.name)),
      }
    }
  }

  const unchanged =
    existingAssigneeIds.length === nextAssigneeIds.length &&
    existingAssigneeIds.every(id => nextAssigneeIds.includes(id))

  if (!unchanged) {
    try {
      await db.transaction(async tx => {
        await syncAssignees(tx, taskId, nextAssigneeIds)
        await tx
          .update(tasks)
          .set({ updatedBy: actor.id, updatedAt: new Date().toISOString() })
          .where(eq(tasks.id, taskId))
      })
    } catch (error) {
      console.error('Failed to set task assignee', error)
      return { ok: false, error: 'Unable to update task.' }
    }

    // Committed. Side effects log their own failures.
    await notifyTaskAssigned(
      actor,
      { id: taskId, title: task.title },
      nextAssigneeIds.filter(id => !existingAssigneeIds.includes(id))
    )

    const snapshot = {
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      projectId: task.projectId,
      leadId: task.leadId,
      dueOn: task.dueOn ?? null,
    }
    const event = buildTaskUpdateEvent(
      { ...snapshot, assigneeIds: existingAssigneeIds },
      { ...snapshot, assigneeIds: nextAssigneeIds }
    )
    if (event) {
      await logActivity({
        actorId: actor.id,
        actorRole: actor.role,
        source,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: taskId,
        targetProjectId: task.projectId,
        targetCompanyId: task.companyId ?? null,
        metadata: event.metadata,
      })
    }
  }

  return { ok: true }
}
