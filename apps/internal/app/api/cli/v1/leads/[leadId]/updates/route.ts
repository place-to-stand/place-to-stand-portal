import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { addLeadUpdate } from '@/lib/cli/leads'
import { getLeadForCli } from '@/lib/cli/queries/leads'
import {
  cliCreateLeadUpdateSchema,
  cliLeadUpdateListQuerySchema,
} from '@/lib/cli/schemas/leads'
import { serializeLeadUpdate } from '@/lib/cli/serializers/lead-update'
import { listLeadUpdates } from '@/lib/queries/lead-updates'

type Params = { leadId: string }

export const GET = withCliAuth<Params>(async ({ user, request, params }) => {
  const query = cliLeadUpdateListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  // Existence check first, so an unknown lead is a 404 rather than an empty
  // list that looks like "no updates yet".
  const lead = await getLeadForCli(user, params.leadId)
  const rows = await listLeadUpdates(user, lead.id)

  return rows.slice(0, query.limit).map(serializeLeadUpdate)
})

export const POST = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = cliCreateLeadUpdateSchema.parse(await readJsonBody(request))

  return jsonOk(await addLeadUpdate(user, params.leadId, payload, 'CLI'), {
    status: 201,
  })
})
