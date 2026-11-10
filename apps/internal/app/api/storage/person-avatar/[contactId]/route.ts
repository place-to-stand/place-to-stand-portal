import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authorizeRoute } from '@/lib/auth/guard'
import { getPersonAvatarPath } from '@/lib/queries/users'
import { avatarImageResponse } from '@/lib/storage/avatar-response'

const paramsSchema = z.object({
  contactId: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/storage/person-avatar/[contactId]'>
) {
  const { denied } = await authorizeRoute('portal.sign_in')
  if (denied) return denied

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { contactId } = parsedParams.data

  return avatarImageResponse(request, () => getPersonAvatarPath(contactId))
}
