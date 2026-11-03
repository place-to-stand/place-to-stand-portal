import { withCliAuth, parseQuery } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeClient } from '@/lib/cli/serializers/client'
import { fetchClientsWithMetrics } from '@/lib/data/clients'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = parseQuery(request, cliListQuerySchema)

  const clients = await fetchClientsWithMetrics(user, query.search)

  return clients.slice(0, query.limit).map(serializeClient)
})
