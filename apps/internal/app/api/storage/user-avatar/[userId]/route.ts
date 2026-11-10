import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authorizeRoute } from '@/lib/auth/guard'
import { getUserAvatarPath } from '@/lib/queries/users'
import { avatarImageResponse } from '@/lib/storage/avatar-response'

const paramsSchema = z.object({
  userId: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/storage/user-avatar/[userId]'>
) {
  const { denied } = await authorizeRoute('portal.sign_in')
  if (denied) return denied

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { userId } = parsedParams.data

  return avatarImageResponse(request, () => getUserAvatarPath(userId))
}
