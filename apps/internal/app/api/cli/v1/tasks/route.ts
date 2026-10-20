import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import {
  fetchAssigneeIdsByTask,
  fetchBoardLocationsByProject,
  listTasksForCli,
} from '@/lib/cli/queries/tasks'
import {
  cliCreateTaskSchema,
  cliTaskListQuerySchema,
} from '@/lib/cli/schemas/tasks'
import { serializeTask } from '@/lib/cli/serializers/task'
import {
  createTaskFromInput,
  resolveProjectId,
  respondToTaskWrite,
} from '@/lib/cli/tasks'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliTaskListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const projectId = query.project
    ? await resolveProjectId(user, query.project)
    : undefined

  const rows = await listTasksForCli(user, {
    projectId,
    leadId: query.lead,
    status: query.status,
    assigneeId: query.assignee,
    limit: query.limit,
  })

  const [assignees, locations] = await Promise.all([
    fetchAssigneeIdsByTask(rows.map(row => row.id)),
    fetchBoardLocationsByProject(rows.map(row => row.projectId)),
  ])

  return rows.map(row =>
    serializeTask(
      row,
      assignees.get(row.id) ?? [],
      locations.get(row.projectId) ?? null
    )
  )
})

export const POST = withCliAuth(async ({ user, request }) => {
  const payload = cliCreateTaskSchema.parse(await readJsonBody(request))

  return respondToTaskWrite(
    await createTaskFromInput(user, payload, 'CLI'),
    201
  )
})
