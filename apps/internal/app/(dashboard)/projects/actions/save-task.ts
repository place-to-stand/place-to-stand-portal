'use server'

import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import {
  ensureProjectAccess,
  ensureTaskAccess,
} from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { taskCreatedEvent, taskUpdatedEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import {
  projects,
  taskAssignees,
  tasks,
} from '@/lib/db/schema'
import { NotFoundError, ForbiddenError } from '@/lib/errors/http'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { resolveCompletedAt } from '@/lib/projects/task-status'
import { resolveNextTaskRank } from './task-rank'

import { revalidateProjectTaskViews } from './shared'
import { baseTaskSchema, type BaseTaskInput } from './shared-schemas'
import type { ActionResult } from './action-types'
import { syncAssignees, syncAttachments } from './task-helpers'

// Local widening (do not touch the shared ActionResult): a result carrying
// `taskId` means the row exists — even alongside `error`, which signals a
// failed post-insert step. Clients must never retry the create path for it.
export type SaveTaskResult = ActionResult & { taskId?: string }

export async function saveTask(input: BaseTaskInput): Promise<SaveTaskResult> {
  const user = await requireUser()
  const parsed = baseTaskSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid task payload submitted.' }
  }

  const {
    id,
    projectId,
    leadId,
    title,
    description,
    status,
    dueOn,
    assigneeIds,
    attachments,
  } = parsed.data

  const normalizedAssigneeIds = Array.from(new Set(assigneeIds))
  const storage = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(storage)

  if (!id) {
    try {
      await ensureProjectAccess(user, projectId)
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { error: 'Selected project is unavailable.' }
      }
      if (error instanceof ForbiddenError) {
        return { error: 'You do not have permission to update this project.' }
      }
      console.error('Failed to authorize project access', error)
      return { error: 'Unable to resolve project for new task.' }
    }

    const projectContext = await db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        name: projects.name,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!projectContext.length) {
      return { error: 'Selected project is unavailable.' }
    }

    let nextRank: string

    try {
      nextRank = await resolveNextTaskRank(projectId, status)
    } catch (rankError) {
      console.error('Failed to resolve rank for new task', rankError)
      return { error: 'Unable to determine ordering for new task.' }
    }

    let insertedId: string | null = null

    try {
      const inserted = await db
        .insert(tasks)
        .values({
          projectId,
          leadId: leadId ?? null,
          title,
          description,
          status,
          dueOn,
          createdBy: user.id,
          updatedBy: user.id,
          rank: nextRank,
          // A task can be created straight into DONE (e.g. logging work that
          // was already finished) — stamp it at birth rather than leaving a
          // null that the two-week window would silently drop.
          ...resolveCompletedAt(status, null),
        })
        .returning({ id: tasks.id })

      insertedId = inserted[0]?.id ?? null
    } catch (error) {
      console.error('Failed to create task', error)
      return {
        error:
          error instanceof Error ? error.message : 'Unable to create task.',
      }
    }

    if (!insertedId) {
      return { error: 'Unable to create task.' }
    }

    // Partial-failure contract: the row exists past this point, so any error
    // must return `taskId` alongside it — a bare error would invite a client
    // retry that duplicates the task.
    try {
      await syncAssignees(insertedId, normalizedAssigneeIds)
      await syncAttachments({
        storage,
        taskId: insertedId,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      // The row exists and the client will navigate to it — cached task
      // views must include it even though a sub-step failed.
      await revalidateProjectTaskViews()
      return {
        taskId: insertedId,
        error: 'Task saved but assignees could not be updated.',
      }
    }

    try {
      const event = taskCreatedEvent({
        title,
        status,
        dueOn: dueOn ?? null,
        assigneeIds: normalizedAssigneeIds,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: insertedId,
        targetProjectId: projectId,
        targetClientId: projectContext[0].clientId,
        metadata: event.metadata,
      })
    } catch (activityError) {
      console.error('Failed to log task creation activity', activityError)
      await revalidateProjectTaskViews()
      return {
        taskId: insertedId,
        error: 'Task saved but activity could not be recorded.',
      }
    }

    await revalidateProjectTaskViews()

    return { taskId: insertedId }
  } else {
    try {
      await ensureTaskAccess(user, id)
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { error: 'Task not found.' }
      }
      if (error instanceof ForbiddenError) {
        return { error: 'You do not have permission to update this task.' }
      }
      console.error('Failed to authorize task access', error)
      return { error: 'Unable to update task.' }
    }

    const existingTaskResult = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        rank: tasks.rank,
        dueOn: tasks.dueOn,
        completedAt: tasks.completedAt,
        clientId: projects.clientId,
      })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .where(eq(tasks.id, id))
      .limit(1)

    const existingTask = existingTaskResult[0]

    if (!existingTask) {
      return { error: 'Task not found.' }
    }

    const projectChanged = existingTask.projectId !== projectId
    let targetClientId = existingTask.clientId ?? null

    // When moving the task to a different project, authorize access to the
    // destination project (mirrors the create path) and resolve its client.
    if (projectChanged) {
      try {
        await ensureProjectAccess(user, projectId)
      } catch (error) {
        if (error instanceof NotFoundError) {
          return { error: 'Selected project is unavailable.' }
        }
        if (error instanceof ForbiddenError) {
          return { error: 'You do not have permission to use this project.' }
        }
        console.error('Failed to authorize project access', error)
        return { error: 'Unable to resolve project for task.' }
      }

      const newProjectContext = await db
        .select({ clientId: projects.clientId })
        .from(projects)
        .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
        .limit(1)

      if (!newProjectContext.length) {
        return { error: 'Selected project is unavailable.' }
      }

      targetClientId = newProjectContext[0].clientId ?? null
    }

    const existingAssignees = await db
      .select({
        userId: taskAssignees.userId,
      })
      .from(taskAssignees)
      .where(
        and(
          eq(taskAssignees.taskId, id),
          isNull(taskAssignees.deletedAt)
        )
      )

    const existingAssigneeIds = existingAssignees.map(
      assignee => assignee.userId
    )

    let nextRank = existingTask.rank

    // Recompute ordering when the status changes, or when the task moves to a
    // new project (so it lands correctly in the destination column).
    if (existingTask.status !== status || projectChanged) {
      try {
        nextRank = await resolveNextTaskRank(
          projectId,
          status
        )
      } catch (rankError) {
        console.error(
          'Failed to resolve rank for task status update',
          rankError
        )
        return { error: 'Unable to update task ordering.' }
      }
    }

    try {
      await db
        .update(tasks)
        .set({
          projectId,
          leadId: leadId ?? null,
          title,
          description,
          status,
          dueOn,
          updatedBy: user.id,
          rank: nextRank,
          ...resolveCompletedAt(status, existingTask.completedAt),
        })
        .where(eq(tasks.id, id))
    } catch (error) {
      console.error('Failed to update task', error)
      return {
        error:
          error instanceof Error ? error.message : 'Unable to update task.',
      }
    }

    try {
      await syncAssignees(id, normalizedAssigneeIds)
      await syncAttachments({
        storage,
        taskId: id,
        actorId: user.id,
        actorRole: user.role,
        attachmentsInput: attachments,
      })
    } catch (assigneeError) {
      console.error('Failed to sync task assignees', assigneeError)
      return { error: 'Task saved but assignees could not be updated.' }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existingTask.title !== title) {
      changedFields.push('title')
      previousDetails.title = existingTask.title
      nextDetails.title = title
    }

    const previousDescription = existingTask.description ?? null
    const nextDescription = description ?? null

    if (previousDescription !== nextDescription) {
      changedFields.push('description')
      previousDetails.description = previousDescription
      nextDetails.description = nextDescription
    }

    if (existingTask.status !== status) {
      changedFields.push('status')
      previousDetails.status = existingTask.status
      nextDetails.status = status
    }

    if (projectChanged) {
      changedFields.push('project')
      previousDetails.projectId = existingTask.projectId
      nextDetails.projectId = projectId
    }

    const previousDueOn = existingTask.dueOn ?? null
    const nextDueOn = dueOn ?? null

    if (previousDueOn !== nextDueOn) {
      changedFields.push('due date')
      previousDetails.dueOn = previousDueOn
      nextDetails.dueOn = nextDueOn
    }

    const addedAssignees = normalizedAssigneeIds.filter(
      assigneeId => !existingAssigneeIds.includes(assigneeId)
    )
    const removedAssignees = existingAssigneeIds.filter(
      assigneeId => !normalizedAssigneeIds.includes(assigneeId)
    )

    const hasAssigneeChanges =
      addedAssignees.length > 0 || removedAssignees.length > 0

    if (hasAssigneeChanges) {
      changedFields.push('assignees')
    }

    const hasDetailChanges =
      Object.keys(previousDetails).length > 0 ||
      Object.keys(nextDetails).length > 0

    if (changedFields.length > 0 || hasAssigneeChanges) {
      const event = taskUpdatedEvent({
        title,
        changedFields,
        details: hasDetailChanges
          ? {
              before: previousDetails,
              after: nextDetails,
            }
          : undefined,
        assigneeChanges: hasAssigneeChanges
          ? { added: addedAssignees, removed: removedAssignees }
          : undefined,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'TASK',
        targetId: id,
        targetProjectId: projectId,
        targetClientId: targetClientId,
        metadata: event.metadata,
      })
    }
  }

  await revalidateProjectTaskViews()

  return { taskId: id }
}
