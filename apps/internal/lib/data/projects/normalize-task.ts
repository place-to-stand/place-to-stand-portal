import type { TaskWithRelations } from '@/lib/types'
import type { RawTaskWithRelations } from './types'

export const normalizeRawTask = (
  task: RawTaskWithRelations
): TaskWithRelations => {
  const {
    assignees: rawAssignees,
    comment_count,
    attachment_count,
    logged_hours,
    attachments,
    ...taskFields
  } = task

  const safeAssignees = (rawAssignees ?? [])
    .filter(assignee => assignee && !assignee.deleted_at)
    .map(assignee => ({ user_id: assignee.user_id }))

  const normalizedCommentCount =
    typeof comment_count === 'number'
      ? comment_count
      : Number(comment_count ?? 0)

  const normalizedAttachments = (attachments ?? []).filter(
    attachment => attachment && !attachment.deleted_at
  )

  const normalizedAttachmentCount =
    typeof attachment_count === 'number'
      ? attachment_count
      : normalizedAttachments.length

  // numeric(8,2) sums arrive as strings from postgres — Number() them once
  // here rather than letting a string leak into the card's formatter.
  const normalizedLoggedHours = Number(logged_hours ?? 0)

  return {
    ...taskFields,
    assignees: safeAssignees,
    commentCount: normalizedCommentCount,
    attachmentCount: normalizedAttachmentCount,
    loggedHours: Number.isFinite(normalizedLoggedHours)
      ? normalizedLoggedHours
      : 0,
    attachments: attachments ? normalizedAttachments : undefined,
  }
}
