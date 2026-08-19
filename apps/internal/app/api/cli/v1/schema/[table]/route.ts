import { withCliAuth } from '@/lib/cli/handler'
import { describeTable } from '@/lib/cli/schema-introspection'
import { NotFoundError } from '@/lib/errors/http'

type Params = { table: string }

export const GET = withCliAuth<Params>(async ({ params }) => {
  const detail = describeTable(params.table)

  if (!detail) {
    throw new NotFoundError(`Unknown table "${params.table}".`)
  }

  return detail
})
