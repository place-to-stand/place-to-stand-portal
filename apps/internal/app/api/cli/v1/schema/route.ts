import { withCliAuth } from '@/lib/cli/handler'
import { listEnums, listTables } from '@/lib/cli/schema-introspection'

export const GET = withCliAuth(async () => ({
  tables: listTables(),
  enums: listEnums(),
}))
