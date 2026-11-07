import 'server-only'

import { randomUUID } from 'node:crypto'

import { resolveNewTaskRank } from '@/lib/tasks/rank'
import { taskCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { findAssigneesWithoutAccess } from '@/lib/projects/access'
import { resolveTaskStatusStamps } from '@/lib/projects/task-status'
import { notifyTaskAssigned } from '@/lib/notifications/in-app/events'

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
import type { SaveTaskResult, TaskWriteContext } from './types'

export async function createTaskForActor({
  actor,
  storage,
  input,
  assigneeIds,
  source,
}: TaskWriteContext): Promise<SaveTaskResult> {
  const { projectId, leadId, title, description, status, dueOn, attachments } =
    input

  const home = resolveTaskHome({ projectId, leadId })
  if (!home) {
    return { error: 'Choose a project or a lead for this task.' }
  }

  const homeContext = await resolveTaskHomeContext(actor, home)
  if ('error' in homeContext) {
    return { error: homeContext.error }
  }

  const { companyId } = homeContext

  const blockedAssignees = await findAssigneesWithoutAccess(
    home.projectId,
    assigneeIds
  )
  if (blockedAssignees.length) {
    return { error: assigneeAccessError(blockedAssignees) }
  }

  let nextRank: string

  try {
    nextRank = await resolveNewTaskRank(home, status)
  } catch (rankError) {
    console.error('Failed to resolve rank for new task', rankError)
    return { error: 'Unable to determine ordering for new task.' }
  }

  // The id is minted here rather than by the insert so new uploads can move
  // into the task's folder before the transaction opens (save-task-children).
  const taskId = randomUUID()

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

  // One transaction: the task, its assignee and its attachment rows land
  // together or not at all, so a failed save leaves nothing behind to retry
  // into a duplicate.
  let attachmentChanges: AttachmentRowChanges
  try {
    attachmentChanges = await db.transaction(async tx => {
      await tx.insert(tasks).values({
        id: taskId,
        projectId: home.projectId,
        leadId: home.leadId,
        title,
        description,
        status,
        dueOn,
        createdBy: actor.id,
        updatedBy: actor.id,
        rank: nextRank,
        // A task can be created straight into DONE (e.g. logging work that
        // was already finished) — stamp it at birth rather than leaving a
        // null that the two-week window would silently drop.
        ...resolveTaskStatusStamps(status, null),
      })

      await syncAssignees(tx, taskId, assigneeIds)

      return writeAttachmentRows(tx, {
        taskId,
        actorId: actor.id,
        actorRole: actor.role,
        staged,
        toRemove: [],
      })
    })
  } catch (error) {
    console.error('Failed to create task', error)
    const restored = await unstageAttachments(storage, staged)
    return { error: saveFailedMessage('Unable to create task.', restored) }
  }

  // Committed. What follows are side effects of the save, not part of it:
  // each logs its own failure and the save still stands.
  await notifyTaskAssigned(actor, { id: taskId, title }, assigneeIds)

  const event = taskCreatedEvent({
    title,
    status,
    dueOn: dueOn ?? null,
    assigneeIds,
  })

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    source,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: home.projectId,
    targetCompanyId: companyId,
    metadata: event.metadata,
  })

  await finishAttachmentChanges({
    storage,
    taskId,
    actorId: actor.id,
    actorRole: actor.role,
    activity: {
      taskTitle: title,
      projectId: home.projectId,
      companyId,
      source,
    },
    changes: attachmentChanges,
  })

  return { taskId }
}
