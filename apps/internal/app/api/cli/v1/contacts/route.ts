import { jsonOk, withCliAuth } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeContact } from '@/lib/cli/serializers/contact'
import { listContactsForSettings } from '@/lib/queries/contacts/settings/list-contacts'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const result = await listContactsForSettings(user, {
    search: query.search ?? null,
    limit: query.limit,
  })

  return jsonOk(result.items.map(serializeContact), {
    meta: { totalCount: result.totalCount },
  })
})
