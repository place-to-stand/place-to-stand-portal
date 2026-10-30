import 'server-only'

import { randomUUID } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import { resolveNewTaskRank } from '@/app/(dashboard)/projects/actions/task-rank'
import { taskCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { projects, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureProjectWorkAccess,
  findAssigneesWithoutAccess,
} from '@/lib/projects/access'
import { resolveCompletedAt } from '@/lib/projects/task-status'
import { notifyTaskAssigned } from '@/lib/notifications/in-app/events'

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

export async function createTaskForActor({
  actor,
  storage,
  input,
  assigneeIds,
  source,
}: TaskWriteContext): Promise<SaveTaskResult> {
  const { projectId, leadId, title, description, status, dueOn, attachments } =
    input

  try {
    await ensureProjectWorkAccess(actor, projectId)
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
      clientId: projects.companyId,
      name: projects.name,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!projectContext.length) {
    return { error: 'Selected project is unavailable.' }
  }

  const clientId = projectContext[0].clientId ?? null

  const blockedAssignees = await findAssigneesWithoutAccess(
    projectId,
    assigneeIds
  )
  if (blockedAssignees.length) {
    return { error: assigneeAccessError(blockedAssignees) }
  }

  let nextRank: string

  try {
    nextRank = await resolveNewTaskRank(projectId, status)
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
        projectId,
        leadId: leadId ?? null,
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
        ...resolveCompletedAt(status, null),
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
    targetProjectId: projectId,
    targetCompanyId: clientId,
    metadata: event.metadata,
  })

  await finishAttachmentChanges({
    storage,
    taskId,
    actorId: actor.id,
    actorRole: actor.role,
    activity: { taskTitle: title, projectId, clientId, source },
    changes: attachmentChanges,
  })

  return { taskId }
}
