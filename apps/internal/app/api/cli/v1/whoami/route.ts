import { withCliAuth } from '@/lib/cli/handler'
import { serializeUser } from '@/lib/cli/serializers/user'

export const GET = withCliAuth(async ({ user }) => serializeUser(user))
