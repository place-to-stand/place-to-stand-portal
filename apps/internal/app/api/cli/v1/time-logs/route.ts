import { jsonOk, withCliAuth } from '@/lib/cli/handler'
import { cliProjectScopedQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeTimeLog } from '@/lib/cli/serializers/time-log'
import { resolveProjectId } from '@/lib/cli/tasks'
import { listProjectTimeLogs } from '@/lib/queries/time-logs/read'

/**
 * Project-scoped by design: the underlying query reads a project's history, and
 * an unbounded cross-project time feed is not something the data layer offers
 * today.
 */
export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliProjectScopedQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const projectId = await resolveProjectId(user, query.project)
  const result = await listProjectTimeLogs(user, projectId, query.limit)

  return jsonOk(result.logs.map(serializeTimeLog), {
    meta: { totalCount: result.totalCount },
  })
})
