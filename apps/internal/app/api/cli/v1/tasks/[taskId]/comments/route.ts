import { z } from 'zod'

import { taskCommentCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { toRichTextHtml } from '@/lib/cli/description'
import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { loadTaskForEdit } from '@/lib/cli/queries/tasks'
import { serializeComment } from '@/lib/cli/serializers/comment'
import { resolveProjectIdentifier } from '@/lib/data/projects'
import {
  createTaskComment,
  listTaskComments,
} from '@/lib/queries/task-comments'

type Params = { taskId: string }

const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'body is required.')
    .max(10_000, 'body exceeds the maximum length.'),
})

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withCliAuth<Params>(async ({ user, request, params }) => {
  const query = listQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const page = await listTaskComments(user, params.taskId, {
    limit: query.limit,
  })

  return jsonOk(page.items.map(serializeComment), {
    meta: { hasNextPage: page.pageInfo.hasNextPage },
  })
})

export const POST = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = createCommentSchema.parse(await readJsonBody(request))

  // Comments render through `sanitizeEditorHtml`, same as descriptions, so
  // plain text needs the same conversion to survive with its structure.
  const body = toRichTextHtml(payload.body)

  const { task } = await loadTaskForEdit(user, params.taskId)
  const { commentId } = await createTaskComment(user, {
    taskId: params.taskId,
    body,
  })

  // The browser logs this from the client after the POST returns
  // (lib/projects/task-sheet/use-task-comments/mutations.ts), so the API route
  // itself never has. A CLI has no such client, and a comment that leaves no
  // audit trail is worse than a duplicated log line — record it here.
  try {
    const project = await resolveProjectIdentifier(user, task.projectId)
    const event = taskCommentCreatedEvent({ taskTitle: task.title })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'COMMENT',
      targetId: commentId,
      targetProjectId: task.projectId,
      targetClientId: project.clientId ?? null,
      metadata: { taskId: params.taskId, commentId, bodyLength: body.length },
    })
  } catch (error) {
    // The comment exists; a missing activity row must not fail the request.
    console.error('Failed to log CLI comment activity', error)
  }

  const page = await listTaskComments(user, params.taskId, { limit: 1 })
  const created = page.items.find(item => item.id === commentId)

  return jsonOk(
    created ? serializeComment(created) : { id: commentId, taskId: params.taskId },
    { status: 201 }
  )
})
