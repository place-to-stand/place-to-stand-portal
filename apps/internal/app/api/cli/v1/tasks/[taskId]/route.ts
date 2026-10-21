import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { cliUpdateTaskSchema } from '@/lib/cli/schemas/tasks'
import {
  loadSerializedTask,
  respondToTaskWrite,
  updateTaskFromInput,
} from '@/lib/cli/tasks'

type Params = { taskId: string }

export const GET = withCliAuth<Params>(async ({ user, params }) =>
  loadSerializedTask(user, params.taskId)
)

/** Partial update; see `updateTaskFromInput` for the omit-vs-null contract. */
export const PATCH = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = cliUpdateTaskSchema.parse(await readJsonBody(request))

  return respondToTaskWrite(
    await updateTaskFromInput(user, params.taskId, payload, 'CLI'),
    200
  )
})
