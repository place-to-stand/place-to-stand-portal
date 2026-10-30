import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { and, eq, inArray, isNull } from 'drizzle-orm'

import type { AttachmentPayload } from '@/app/(dashboard)/projects/actions/shared-schemas'
import {
  taskAttachmentsAddedEvent,
  taskAttachmentsRemovedEvent,
} from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { db } from '@/lib/db'
import { taskAssignees, taskAttachments } from '@/lib/db/schema'
import {
  deleteAttachmentObject,
  isPendingAttachmentPath,
  moveAttachmentToTaskFolder,
} from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import type { Database } from '@/lib/supabase/types'
import type { ActivitySourceValue } from '@/lib/types'

/**
 * The rows a task save writes besides the task itself — assignees and
 * attachments — split so the database half runs inside the save's one
 * transaction and the storage half runs around it.
 *
 * Storage can't join a Postgres transaction, so attachments go in three
 * steps:
 *   1. `stageAttachments` (before the transaction) moves each new upload from
 *      `attachments/pending/<actor>/…` into the task's folder.
 *   2. `writeAttachmentRows` (inside it) inserts the rows for those files and
 *      soft-deletes removed ones.
 *   3. `finishAttachmentChanges` (after commit) deletes removed files from
 *      storage and records the activity.
 * If the transaction fails, `unstageAttachments` moves the files back to the
 * pending folder, so the sheet can save again with the same uploads. That
 * order means a committed attachment row always points at a file that
 * exists; the worst case is an orphaned file with no row, never a row with no
 * file.
 */

type UserRole = Database['public']['Enums']['user_role']
type StorageClient = SupabaseClient<Database>

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type DbExecutor = typeof db | DbTransaction

/**
 * A task has one assignee. Callers may still pass a list (the CLI and MCP
 * accept one for compatibility); only the first is kept.
 */
export async function syncAssignees(
  executor: DbExecutor,
  taskId: string,
  assigneeIds: string[]
) {
  const deletionTimestamp = new Date().toISOString()
  const assignee = assigneeIds[0]

  await executor
    .update(taskAssignees)
    .set({ deletedAt: deletionTimestamp })
    .where(eq(taskAssignees.taskId, taskId))

  if (!assignee) {
    return
  }

  await executor
    .insert(taskAssignees)
    .values({ taskId, userId: assignee, deletedAt: null })
    .onConflictDoUpdate({
      target: [taskAssignees.taskId, taskAssignees.userId],
      set: { deletedAt: null },
    })
}

/** A new upload moved into the task's folder, not yet recorded in the DB. */
export type StagedAttachment = {
  /** Where the file was before staging (its pending path). */
  from: string
  /** Where it lives now, and what the row records. */
  to: string
  originalName: string
  mimeType: string
  fileSize: number
}

async function moveObject(storage: StorageClient, from: string, to: string) {
  const { error } = await storage.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .move(from, to)

  if (error) {
    throw error
  }
}

/**
 * Moves the new uploads into the task's folder. All or nothing: if one move
 * fails, the ones already moved go back and the error is rethrown.
 */
export async function stageAttachments({
  storage,
  taskId,
  actorId,
  actorRole,
  attachmentsInput,
}: {
  storage: StorageClient
  taskId: string
  actorId: string
  actorRole: UserRole
  attachmentsInput?: AttachmentPayload
}): Promise<StagedAttachment[]> {
  const staged: StagedAttachment[] = []

  for (const attachment of attachmentsInput?.toAttach ?? []) {
    // Non-admins may only attach files they uploaded themselves.
    if (
      actorRole !== 'ADMIN' &&
      !isPendingAttachmentPath(attachment.path, actorId)
    ) {
      continue
    }

    try {
      const destination = await moveAttachmentToTaskFolder({
        client: storage,
        path: attachment.path,
        taskId,
      })

      if (!destination) {
        continue
      }

      staged.push({
        from: attachment.path,
        to: destination,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
      })
    } catch (error) {
      await unstageAttachments(storage, staged)
      throw error
    }
  }

  return staged
}

/**
 * Undoes `stageAttachments` after a failed save. Returns false when a file
 * could not be moved back: it then sits in the task folder with no row, and
 * the sheet's pending path for it no longer exists.
 */
export async function unstageAttachments(
  storage: StorageClient,
  staged: StagedAttachment[]
): Promise<boolean> {
  let restored = true

  for (const attachment of staged) {
    if (attachment.from === attachment.to) {
      continue
    }

    try {
      await moveObject(storage, attachment.to, attachment.from)
    } catch (error) {
      restored = false
      console.error('Failed to move attachment back to pending', error)
    }
  }

  return restored
}

export type AttachmentRowChanges = {
  addedNames: string[]
  removed: Array<{ storagePath: string; originalName: string }>
}

/** The database half of an attachment change; run inside the transaction. */
export async function writeAttachmentRows(
  tx: DbExecutor,
  {
    taskId,
    actorId,
    actorRole,
    staged,
    toRemove,
  }: {
    taskId: string
    actorId: string
    actorRole: UserRole
    staged: StagedAttachment[]
    toRemove: string[]
  }
): Promise<AttachmentRowChanges> {
  if (staged.length) {
    await tx.insert(taskAttachments).values(
      staged.map(attachment => ({
        taskId,
        storagePath: attachment.to,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        uploadedBy: actorId,
      }))
    )
  }

  let removed: AttachmentRowChanges['removed'] = []

  if (toRemove.length) {
    const existing = await tx
      .select({
        id: taskAttachments.id,
        storagePath: taskAttachments.storagePath,
        originalName: taskAttachments.originalName,
      })
      .from(taskAttachments)
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          inArray(taskAttachments.id, toRemove),
          isNull(taskAttachments.deletedAt),
          // Deleting a file can't be undone, so only admins may remove files
          // someone else uploaded.
          actorRole === 'ADMIN'
            ? undefined
            : eq(taskAttachments.uploadedBy, actorId)
        )
      )

    if (existing.length) {
      await tx
        .update(taskAttachments)
        .set({ deletedAt: new Date().toISOString() })
        .where(
          inArray(
            taskAttachments.id,
            existing.map(attachment => attachment.id)
          )
        )
    }

    removed = existing.map(({ storagePath, originalName }) => ({
      storagePath,
      originalName,
    }))
  }

  return {
    addedNames: staged.map(attachment => attachment.originalName),
    removed,
  }
}

/**
 * Where attachment activity is recorded. Uploads are staged into a pending
 * folder before the task is saved, so the upload route sees files that may
 * never be attached; the save is the one place that knows what actually
 * landed on (or left) the task.
 */
export type AttachmentActivityContext = {
  taskTitle: string
  projectId: string
  companyId: string | null
  source: ActivitySourceValue
}

/**
 * After commit: delete removed files from storage (best effort — the rows are
 * already soft-deleted, so a leftover file is only an orphan) and record the
 * activity.
 */
export async function finishAttachmentChanges({
  storage,
  taskId,
  actorId,
  actorRole,
  activity,
  changes,
}: {
  storage: StorageClient
  taskId: string
  actorId: string
  actorRole: UserRole
  activity: AttachmentActivityContext
  changes: AttachmentRowChanges
}) {
  if (changes.removed.length) {
    await Promise.all(
      changes.removed.map(async attachment => {
        try {
          await deleteAttachmentObject({
            client: storage,
            path: attachment.storagePath,
          })
        } catch (storageError) {
          console.error('Failed to delete attachment object', storageError)
        }
      })
    )
  }

  const events = [
    changes.addedNames.length
      ? taskAttachmentsAddedEvent({
          taskTitle: activity.taskTitle,
          fileNames: changes.addedNames,
        })
      : null,
    changes.removed.length
      ? taskAttachmentsRemovedEvent({
          taskTitle: activity.taskTitle,
          fileNames: changes.removed.map(attachment => attachment.originalName),
        })
      : null,
  ]

  for (const event of events) {
    if (!event) {
      continue
    }

    await logActivity({
      actorId,
      actorRole,
      source: activity.source,
      verb: event.verb,
      summary: event.summary,
      targetType: 'TASK',
      targetId: taskId,
      targetProjectId: activity.projectId,
      targetCompanyId: activity.companyId,
      metadata: event.metadata,
    })
  }
}

/** The error a failed save returns, naming any files left stranded. */
export function saveFailedMessage(base: string, attachmentsRestored: boolean) {
  return attachmentsRestored
    ? base
    : `${base} Some attachments could not be restored; remove them and upload again.`
}
