import { toRichTextHtml } from '@/lib/cli/description'
import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { resolveLeadAssignee, respondToLeadWrite } from '@/lib/cli/leads'
import { getLeadForCli } from '@/lib/cli/queries/leads'
import { cliUpdateLeadSchema } from '@/lib/cli/schemas/leads'
import { serializeLead } from '@/lib/cli/serializers/lead'
import { extractLeadNotes } from '@/lib/leads/notes'
import { saveLeadForActor } from '@/lib/leads/save-lead-core'

type Params = { leadId: string }

export const GET = withCliAuth<Params>(async ({ user, params }) =>
  serializeLead(await getLeadForCli(user, params.leadId))
)

/**
 * Partial update. The underlying save is a full replace, so every omitted
 * field is read back from the current row and sent unchanged. An explicit
 * `null` clears a field; `undefined` (omitted) preserves it.
 *
 * A status change here goes through the same path as the sheet's status
 * picker: stage history, rank reset, and the resolved/converted bookkeeping.
 */
export const PATCH = withCliAuth<Params>(async ({ user, request, params }) => {
  const payload = cliUpdateLeadSchema.parse(await readJsonBody(request))
  const lead = await getLeadForCli(user, params.leadId)

  const keep = <T>(next: T | undefined, current: T): T =>
    next === undefined ? current : next

  const result = await saveLeadForActor(
    user,
    {
      id: lead.id,
      contactName: payload.name ?? lead.contactName,
      status: payload.status ?? lead.status,
      sourceType: keep(payload.source, lead.sourceType),
      sourceDetail: keep(payload.sourceDetail, lead.sourceDetail),
      assigneeId:
        payload.assignee === undefined
          ? lead.assigneeId
          : await resolveLeadAssignee(user, payload.assignee),
      contactEmail: keep(payload.email, lead.contactEmail),
      contactPhone: keep(payload.phone, lead.contactPhone),
      companyName: keep(payload.company, lead.companyName),
      companyWebsite: keep(payload.website, lead.companyWebsite),
      notes:
        payload.notes === undefined
          ? extractLeadNotes(lead.notes)
          : payload.notes === null
            ? null
            : toRichTextHtml(payload.notes),
    },
    'CLI'
  )

  return respondToLeadWrite(user, result, 200)
})
