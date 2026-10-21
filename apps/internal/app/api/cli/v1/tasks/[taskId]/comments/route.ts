import { z } from 'zod'

import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { cliCreateCommentSchema } from '@/lib/cli/schemas/tasks'
import { serializeComment } from '@/lib/cli/serializers/comment'
import { addTaskComment } from '@/lib/cli/tasks'
import { listTaskComments } from '@/lib/queries/task-comments'

type Params = { taskId: string }

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
  const payload = cliCreateCommentSchema.parse(await readJsonBody(request))

  return jsonOk(
    await addTaskComment(user, params.taskId, payload.body, 'CLI'),
    { status: 201 }
  )
})
