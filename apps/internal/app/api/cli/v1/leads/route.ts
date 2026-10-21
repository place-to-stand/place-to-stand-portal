import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { createLeadFromInput } from '@/lib/cli/leads'
import { listLeadsForCli } from '@/lib/cli/queries/leads'
import { resolveUserIds } from '@/lib/cli/queries/users'
import {
  cliCreateLeadSchema,
  cliLeadListQuerySchema,
} from '@/lib/cli/schemas/leads'
import { serializeLead } from '@/lib/cli/serializers/lead'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliLeadListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const [assigneeId] = query.assignee
    ? await resolveUserIds(user, [query.assignee])
    : []

  const rows = await listLeadsForCli(user, {
    status: query.status,
    assigneeId,
    search: query.search,
    limit: query.limit,
  })

  return rows.map(serializeLead)
})

export const POST = withCliAuth(async ({ user, request }) => {
  const payload = cliCreateLeadSchema.parse(await readJsonBody(request))

  return jsonOk(await createLeadFromInput(user, payload, 'CLI'), {
    status: 201,
  })
})
