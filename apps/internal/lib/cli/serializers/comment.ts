import type { TaskCommentWithAuthor } from '@/lib/types'

export type CliComment = {
  id: string
  taskId: string
  authorId: string
  /** The display name, which may be unset; `authorEmail` always identifies. */
  authorName: string | null
  authorEmail: string | null
  body: string
  createdAt: string
  updatedAt: string | null
}

export function serializeComment(comment: TaskCommentWithAuthor): CliComment {
  return {
    id: comment.id,
    taskId: comment.task_id,
    authorId: comment.author_id,
    authorName: comment.author?.full_name ?? null,
    authorEmail: comment.author?.email ?? null,
    body: comment.body ?? '',
    createdAt: comment.created_at,
    updatedAt: comment.updated_at ?? null,
  }
}
