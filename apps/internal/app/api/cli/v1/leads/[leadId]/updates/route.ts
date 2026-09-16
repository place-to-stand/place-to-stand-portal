import { revalidateLeadsPath } from '@/app/(dashboard)/leads/_actions/utils'
import { toRichTextHtml } from '@/lib/cli/description'
import { jsonOk, readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { getLeadForCli } from '@/lib/cli/queries/leads'
import {
  cliCreateLeadUpdateSchema,
  cliLeadUpdateListQuerySchema,
} from '@/lib/cli/schemas/leads'
import { serializeLeadUpdate } from '@/lib/cli/serializers/lead-update'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { createLeadUpdateForActor } from '@/lib/leads/lead-update-core'
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
  const lead = await getLeadForCli(user, params.leadId)

  const result = await createLeadUpdateForActor(
    user,
    {
      leadId: lead.id,
      type: payload.type,
      // Timeline entries render through the same sanitizer as comments, so
      // plain text needs the same conversion to keep its paragraphs.
      body: toRichTextHtml(payload.body),
      occurredAt: payload.occurredAt ?? undefined,
    },
    'CLI'
  )

  if (!result.success || !result.updateId) {
    if (result.notFound) {
      throw new NotFoundError(result.error ?? 'Lead not found.')
    }

    throw new BadRequestError(result.error ?? 'Unable to log update.')
  }

  revalidateLeadsPath()

  const rows = await listLeadUpdates(user, lead.id)
  const created = rows.find(row => row.id === result.updateId)

  return jsonOk(
    created
      ? serializeLeadUpdate(created)
      : { id: result.updateId, leadId: lead.id },
    { status: 201 }
  )
})
