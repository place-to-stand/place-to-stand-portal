import { toRichTextHtml } from '@/lib/cli/description'
import { readJsonBody, withCliAuth } from '@/lib/cli/handler'
import { resolveLeadAssignee, respondToLeadWrite } from '@/lib/cli/leads'
import { listLeadsForCli } from '@/lib/cli/queries/leads'
import { resolveUserIds } from '@/lib/cli/queries/users'
import {
  cliCreateLeadSchema,
  cliLeadListQuerySchema,
} from '@/lib/cli/schemas/leads'
import { serializeLead } from '@/lib/cli/serializers/lead'
import { saveLeadForActor } from '@/lib/leads/save-lead-core'

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
  const assigneeId = await resolveLeadAssignee(user, payload.assignee)

  const result = await saveLeadForActor(
    user,
    {
      contactName: payload.name,
      status: payload.status,
      sourceType: payload.source ?? null,
      sourceDetail: payload.sourceDetail ?? null,
      assigneeId,
      contactEmail: payload.email ?? null,
      contactPhone: payload.phone ?? null,
      companyName: payload.company ?? null,
      companyWebsite: payload.website ?? null,
      notes: payload.notes ? toRichTextHtml(payload.notes) : null,
    },
    'CLI'
  )

  return respondToLeadWrite(user, result, 201)
})
