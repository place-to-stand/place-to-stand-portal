import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { resolveMovedTaskRank } from '@/app/(dashboard)/projects/actions/task-rank'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { projects, taskAssignees, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureProjectWorkAccess,
  ensureTaskWorkAccess,
  findAssigneesWithoutAccess,
} from '@/lib/projects/access'
import { resolveCompletedAt } from '@/lib/projects/task-status'

import { pinTaskToTopOfAssigneeBoards } from './assignee-sort'
import { buildTaskUpdateEvent } from './save-task-activity'
import { assigneeAccessError } from './assignee-access'
import {
  finishAttachmentChanges,
  saveFailedMessage,
  stageAttachments,
  syncAssignees,
  unstageAttachments,
  writeAttachmentRows,
  type AttachmentRowChanges,
  type StagedAttachment,
} from './save-task-children'
import type { SaveTaskResult, TaskWriteContext } from './types'
import { notifyTaskAssigned } from '@/lib/notifications/in-app/events'

export async function updateTaskForActor(
  taskId: string,
  { actor, storage, input, assigneeIds, source }: TaskWriteContext
): Promise<SaveTaskResult> {
  const { projectId, leadId, title, description, status, dueOn, attachments } =
    input

  try {
    await ensureTaskWorkAccess(actor, taskId)
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
      leadId: tasks.leadId,
      clientId: projects.companyId,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const existingTask = existingTaskResult[0]

  if (!existingTask) {
    return { error: 'Task not found.' }
  }

  const projectChanged = existingTask.projectId !== projectId
  let targetCompanyId = existingTask.clientId ?? null

  // When moving the task to a different project, authorize access to the
  // destination project (mirrors the create path) and resolve its client.
  if (projectChanged) {
    // A client task's time logs stay on its client project, so moving it
    // elsewhere breaks billing. Only admins may do that.
    if (actor.role !== 'ADMIN' && existingTask.clientId) {
      return { error: 'Only an admin can move a task off a client project.' }
    }

    try {
      await ensureProjectWorkAccess(actor, projectId)
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
      .select({ clientId: projects.companyId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)

    if (!newProjectContext.length) {
      return { error: 'Selected project is unavailable.' }
    }

    targetCompanyId = newProjectContext[0].clientId ?? null
  }

  const existingAssignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(
      and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt))
    )

  const existingAssigneeIds = existingAssignees.map(assignee => assignee.userId)

  // Check new assignees only (all of them when the task changes project), so
  // an older assignment never blocks an unrelated edit.
  const blockedAssignees = await findAssigneesWithoutAccess(
    projectId,
    projectChanged
      ? assigneeIds
      : assigneeIds.filter(id => !existingAssigneeIds.includes(id))
  )
  if (blockedAssignees.length) {
    return { error: assigneeAccessError(blockedAssignees) }
  }

  const statusChanged = existingTask.status !== status
  let nextRank = existingTask.rank

  // Recompute ordering when the status changes, or when the task moves to a
  // new project (so it lands correctly in the destination column).
  if (statusChanged || projectChanged) {
    try {
      nextRank = await resolveMovedTaskRank(projectId, status)
    } catch (rankError) {
      console.error('Failed to resolve rank for task status update', rankError)
      return { error: 'Unable to update task ordering.' }
    }
  }

  let staged: StagedAttachment[]
  try {
    staged = await stageAttachments({
      storage,
      taskId,
      actorId: actor.id,
      actorRole: actor.role,
      attachmentsInput: attachments,
    })
  } catch (error) {
    console.error('Failed to stage task attachments', error)
    return { error: 'Unable to attach files. Remove them and upload again.' }
  }

  // One transaction: the task row, its assignee, its attachment rows and the
  // My Tasks pin are saved together or not at all.
  let attachmentChanges: AttachmentRowChanges
  try {
    attachmentChanges = await db.transaction(async tx => {
      await tx
        .update(tasks)
        .set({
          projectId,
          // PATCH semantics: an omitted leadId keeps the existing lead link,
          // only an explicit null clears it. `?? null` here once let any save
          // path that didn't know about leads silently sever tasks.lead_id.
          leadId: leadId !== undefined ? leadId : existingTask.leadId,
          title,
          description,
          status,
          dueOn,
          updatedBy: actor.id,
          // There is no on-update trigger for `updated_at`, so an edit that
          // does not set it here leaves the row looking untouched.
          updatedAt: new Date().toISOString(),
          rank: nextRank,
          ...resolveCompletedAt(status, existingTask.completedAt),
        })
        .where(eq(tasks.id, taskId))

      await syncAssignees(tx, taskId, assigneeIds)

      const changes = await writeAttachmentRows(tx, {
        taskId,
        actorId: actor.id,
        actorRole: actor.role,
        staged,
        toRemove: attachments?.toRemove ?? [],
      })

      // After the assignee sync, so the pin lands on the final assignee set.
      if (statusChanged) {
        await pinTaskToTopOfAssigneeBoards(taskId, status, tx)
      }

      return changes
    })
  } catch (error) {
    console.error('Failed to update task', error)
    const restored = await unstageAttachments(storage, staged)
    return { error: saveFailedMessage('Unable to update task.', restored) }
  }

  // Committed. What follows are side effects of the save, not part of it:
  // each logs its own failure and the save still stands.
  await notifyTaskAssigned(
    actor,
    { id: taskId, title },
    assigneeIds.filter(id => !existingAssigneeIds.includes(id))
  )

  const event = buildTaskUpdateEvent(
    {
      title: existingTask.title,
      description: existingTask.description ?? null,
      status: existingTask.status,
      projectId: existingTask.projectId,
      dueOn: existingTask.dueOn ?? null,
      assigneeIds: existingAssigneeIds,
    },
    {
      title,
      description: description ?? null,
      status,
      projectId,
      dueOn: dueOn ?? null,
      assigneeIds,
    }
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
      targetProjectId: projectId,
      targetCompanyId,
      metadata: event.metadata,
    })
  }

  await finishAttachmentChanges({
    storage,
    taskId,
    actorId: actor.id,
    actorRole: actor.role,
    activity: { taskTitle: title, projectId, clientId: targetCompanyId, source },
    changes: attachmentChanges,
  })

  return { taskId }
}
