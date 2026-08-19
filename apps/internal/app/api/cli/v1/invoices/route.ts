import { jsonOk, withCliAuth } from '@/lib/cli/handler'
import { cliListQuerySchema } from '@/lib/cli/schemas/listing'
import { serializeInvoice } from '@/lib/cli/serializers/invoice'
import { listInvoices } from '@/lib/queries/invoices'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const result = await listInvoices(user, {
    search: query.search,
    limit: query.limit,
  })

  return jsonOk(result.items.map(serializeInvoice), {
    meta: { totalCount: result.totalCount },
  })
})
