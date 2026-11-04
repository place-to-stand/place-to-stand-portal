import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import { taskArchivedEvent, taskRestoredEvent } from '@/lib/activity/events'
import { roleCan } from '@/lib/auth/capabilities'
import { ensureTaskAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, projects, taskAttachments, tasks } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { ensureTaskWorkAccess } from '@/lib/projects/access'
import { deleteAttachmentObject } from '@/lib/storage/task-attachments'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/types/json'

/**
 * Archiving and restoring a task, for the board's server actions and MCP.
 * Both throw NotFoundError / ForbiddenError; callers refresh the task views.
 */

async function loadTask(taskId: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      deletedAt: tasks.deletedAt,
      projectId: tasks.projectId,
      companyId: sql<
        string | null
      >`coalesce(${projects.companyId}, ${leads.companyId})`,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(leads, eq(leads.id, tasks.leadId))
    .where(eq(tasks.id, taskId))
    .limit(1)
  if (!task) throw new NotFoundError('Task not found.')
  return task
}

/** Anyone who can work the task may archive it. */
export async function archiveTask(user: AppUser, taskId: string) {
  await ensureTaskWorkAccess(user, taskId)
  const task = await loadTask(taskId)
  const timestamp = new Date().toISOString()

  await db
    .update(tasks)
    .set({ deletedAt: timestamp })
    .where(eq(tasks.id, taskId))

  // Archiving deletes the task's files for good. Only admins may do that;
  // a task another staff member archives keeps its files, so an admin
  // restore brings everything back.
  const attachmentRows = !roleCan(user.role, 'projects.manage')
    ? []
    : await db
        .select({
          id: taskAttachments.id,
          storagePath: taskAttachments.storagePath,
        })
        .from(taskAttachments)
        .where(
          and(
            eq(taskAttachments.taskId, taskId),
            isNull(taskAttachments.deletedAt)
          )
        )

  if (attachmentRows.length) {
    await db
      .update(taskAttachments)
      .set({ deletedAt: timestamp })
      .where(
        and(
          eq(taskAttachments.taskId, taskId),
          isNull(taskAttachments.deletedAt)
        )
      )

    const storage = getSupabaseServiceClient()
    await Promise.all(
      attachmentRows.map(async attachment => {
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

  const event = taskArchivedEvent({ title: task.title ?? 'Task' })
  const attachmentsRemoved = attachmentRows.map(attachment => attachment.id)
  const metadata =
    event.metadata &&
    typeof event.metadata === 'object' &&
    !Array.isArray(event.metadata)
      ? { ...(event.metadata as Record<string, unknown>), attachmentsRemoved }
      : { attachmentsRemoved }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'TASK',
    targetId: taskId,
    targetProjectId: task.projectId,
    targetCompanyId: task.companyId ?? null,
    metadata: JSON.parse(JSON.stringify(metadata)) as Json,
  })
}

/** Restoring is for admins (the board's Review tab). */
export async function restoreTask(user: AppUser, taskId: string) {
  if (!roleCan(user.role, 'projects.admin_tabs')) {
    throw new ForbiddenError('Only administrators can restore tasks.')
  }
  await ensureTaskAccess(user, taskId, { includeArchived: true })
  const task = await loadTask(taskId)
  if (!task.deletedAt) return

  await db.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, taskId))

  const event = taskRestoredEvent({ title: task.title ?? 'Task' })
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
}
