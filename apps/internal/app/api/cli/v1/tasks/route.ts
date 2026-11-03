import {
  jsonOk,
  parseQuery,
  readJsonBody,
  withCliAuth,
} from '@/lib/cli/handler'
import {
  cliCreateTaskSchema,
  cliTaskListQuerySchema,
} from '@/lib/cli/schemas/tasks'
import {
  createTaskFromInput,
  listTasksForAgent,
  respondToTaskWrite,
} from '@/lib/cli/tasks'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = parseQuery(request, cliTaskListQuerySchema)
  const { items, hasMore } = await listTasksForAgent(user, query)

  return jsonOk(items, { meta: { hasMore } })
})

export const POST = withCliAuth(async ({ user, request }) => {
  const payload = cliCreateTaskSchema.parse(await readJsonBody(request))

  return respondToTaskWrite(
    await createTaskFromInput(user, payload, 'CLI'),
    201
  )
})
