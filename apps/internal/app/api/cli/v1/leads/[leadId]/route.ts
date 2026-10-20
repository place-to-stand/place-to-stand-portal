import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { updateLeadFromInput } from '@/lib/cli/leads'
import { getLeadForCli } from '@/lib/cli/queries/leads'
import { cliUpdateLeadSchema } from '@/lib/cli/schemas/leads'
import { serializeLead } from '@/lib/cli/serializers/lead'

type Params = { leadId: string }

export const GET = withCliAuth<Params>(async ({ user, params }) =>
  serializeLead(await getLeadForCli(user, params.leadId))
)

/** Partial update; see `updateLeadFromInput` for the omit-vs-null contract. */
export const PATCH = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = cliUpdateLeadSchema.parse(await readJsonBody(request))

  return updateLeadFromInput(user, params.leadId, payload, 'CLI')
})
