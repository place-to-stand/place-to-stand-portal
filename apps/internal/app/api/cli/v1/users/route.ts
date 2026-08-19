import { withCliAuth } from '@/lib/cli/handler'
import { listUsersForCli } from '@/lib/cli/queries/users'
import { cliUserListQuerySchema } from '@/lib/cli/schemas/users'
import { serializeUserRow } from '@/lib/cli/serializers/user'

export const GET = withCliAuth(async ({ user, request }) => {
  const query = cliUserListQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams)
  )

  const rows = await listUsersForCli(user, {
    search: query.search,
    role: query.role,
    limit: query.limit,
  })

  return rows.map(serializeUserRow)
})
