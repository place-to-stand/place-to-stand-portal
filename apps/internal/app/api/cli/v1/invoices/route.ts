import { jsonOk, withCliAuth, parseQuery } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeInvoice } from '@/lib/cli/serializers/invoice'
import { listInvoices } from '@/lib/queries/invoices'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = parseQuery(request, cliListQuerySchema)

  const result = await listInvoices(user, {
    search: query.search,
    limit: query.limit,
  })

  return jsonOk(result.items.map(serializeInvoice), {
    meta: { totalCount: result.totalCount },
  })
})
