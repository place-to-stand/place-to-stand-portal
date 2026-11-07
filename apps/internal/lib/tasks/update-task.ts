import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { resolveMovedTaskRank } from '@/lib/tasks/rank'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import {
  leads,
  projects,
  taskAssignees,
  tasks,
  timeLogs,
  timeLogTasks,
} from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureTaskWorkAccess,
  findAssigneesWithoutAccess,
} from '@/lib/projects/access'
import { resolveTaskStatusStamps } from '@/lib/projects/task-status'

import { pinTaskToTopOfAssigneeBoards } from './assignee-sort'
import { buildTaskUpdateEvent } from './save-task-activity'
import { assigneeAccessError } from './assignee-access'
import { resolveTaskHome } from './home'
import { resolveTaskHomeContext } from './home-context'
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
import {
  TASK_SAVED_ELSEWHERE,
  type SaveTaskResult,
  type TaskWriteContext,
} from './types'
import {
  describeSaveConflict,
  lockForSave,
  readSavedVersion,
  SaveConflictError,
} from '@/lib/sheets/save-conflict/server'
import { notifyTaskAssigned } from '@/lib/notifications/in-app/events'
import { roleCan } from '@/lib/auth/capabilities'

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
      companyId: sql<
        string | null
      >`coalesce(${projects.companyId}, ${leads.companyId})`,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(leads, eq(leads.id, tasks.leadId))
    .where(eq(tasks.id, taskId))
    .limit(1)

  const existingTask = existingTaskResult[0]

  if (!existingTask) {
    return { error: 'Task not found.' }
  }

  if (projectId === null && leadId === null) {
    return { error: 'Choose a project or a lead for this task.' }
  }

  // Picking a project or a lead clears the other; sending neither keeps the
  // task where it is.
  const home = resolveTaskHome({ projectId, leadId }) ?? {
    projectId: existingTask.projectId,
    leadId: existingTask.leadId,
  }
  const homeChanged =
    existingTask.projectId !== home.projectId ||
    existingTask.leadId !== home.leadId
  let targetCompanyId = existingTask.companyId ?? null

  // When the task moves, authorize the destination (mirrors the create path)
  // and resolve its company.
  if (homeChanged) {
    // A client task's time logs stay on its client project, so moving it
    // elsewhere breaks billing. Only admins may do that.
    if (
      !roleCan(actor.role, 'tasks.move_off_client_project') &&
      existingTask.projectId &&
      existingTask.companyId
    ) {
      return { error: 'Only an admin can move a task off a client project.' }
    }

    // Time logs belong to the task's project, and the database checks that
    // each linked time log is on the same project as its task. A move would
    // leave those links pointing across projects, so it waits until they
    // are archived.
    const [loggedTime] =
      existingTask.projectId !== home.projectId
        ? await db
            .select({ id: timeLogTasks.id })
            .from(timeLogTasks)
            .innerJoin(timeLogs, eq(timeLogs.id, timeLogTasks.timeLogId))
            .where(
              and(
                eq(timeLogTasks.taskId, taskId),
                isNull(timeLogTasks.deletedAt),
                isNull(timeLogs.deletedAt)
              )
            )
            .limit(1)
        : []

    if (loggedTime) {
      return {
        error:
          "This task has time logged on its project, so it can't move. Archive those time logs first.",
      }
    }

    const homeContext = await resolveTaskHomeContext(actor, home)
    if ('error' in homeContext) {
      return { error: homeContext.error }
    }

    targetCompanyId = homeContext.companyId
  }

  const existingAssignees = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(
      and(eq(taskAssignees.taskId, taskId), isNull(taskAssignees.deletedAt))
    )

  const existingAssigneeIds = existingAssignees.map(assignee => assignee.userId)

  // Check new assignees only (all of them when the task moves), so an older
  // assignment never blocks an unrelated edit.
  const blockedAssignees = await findAssigneesWithoutAccess(
    home.projectId,
    homeChanged
      ? assigneeIds
      : assigneeIds.filter(id => !existingAssigneeIds.includes(id))
  )
  if (blockedAssignees.length) {
    return { error: assigneeAccessError(blockedAssignees) }
  }

  const statusChanged = existingTask.status !== status
  let nextRank = existingTask.rank

  // Recompute ordering when the status changes, or when the task moves to a
  // new project or lead (so it lands correctly in the destination column).
  if (statusChanged || homeChanged) {
    try {
      nextRank = await resolveMovedTaskRank(home, status)
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
  let savedVersion: string | null = null
  try {
    attachmentChanges = await db.transaction(async tx => {
      await lockForSave(tx, tasks, taskId, input.expectedUpdatedAt)
      await tx
        .update(tasks)
        .set({
          projectId: home.projectId,
          leadId: home.leadId,
          title,
          description,
          status,
          dueOn,
          updatedBy: actor.id,
          // The tasks_set_updated_at trigger stamps it too; set here as well
          // so the intent reads in the code.
          updatedAt: new Date().toISOString(),
          rank: nextRank,
          ...resolveTaskStatusStamps(status, existingTask.completedAt),
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

      savedVersion = await readSavedVersion(tx, tasks, taskId)
      return changes
    })
  } catch (error) {
    if (error instanceof SaveConflictError) {
      await unstageAttachments(storage, staged)
      return {
        error: TASK_SAVED_ELSEWHERE,
        conflict: await describeSaveConflict(
          actor,
          'TASK',
          taskId,
          error,
          input.expectedUpdatedAt
        ),
      }
    }
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
      leadId: existingTask.leadId,
      dueOn: existingTask.dueOn ?? null,
      assigneeIds: existingAssigneeIds,
    },
    {
      title,
      description: description ?? null,
      status,
      projectId: home.projectId,
      leadId: home.leadId,
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
      targetProjectId: home.projectId,
      targetCompanyId,
      metadata: event.metadata,
    })
  }

  await finishAttachmentChanges({
    storage,
    taskId,
    actorId: actor.id,
    actorRole: actor.role,
    activity: {
      taskTitle: title,
      projectId: home.projectId,
      companyId: targetCompanyId,
      source,
    },
    changes: attachmentChanges,
  })

  return { taskId, updatedAt: savedVersion ?? undefined }
}
