import { jsonOk, withCliAuth } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeContact } from '@/lib/cli/serializers/contact'
import { listContactsForSettings } from '@/lib/queries/contacts/settings/list-contacts'
import { listContactMemberships } from '@/lib/queries/memberships'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const result = await listContactsForSettings(user, {
    search: query.search ?? null,
    limit: query.limit,
  })

  const memberships = await listContactMemberships(
    result.items.map(contact => contact.id)
  )
  return jsonOk(
    result.items.map(contact =>
      serializeContact(contact, memberships.get(contact.id), {
        viewerRole: user.role,
      })
    ),
    {
      meta: { totalCount: result.totalCount },
    }
  )
})
