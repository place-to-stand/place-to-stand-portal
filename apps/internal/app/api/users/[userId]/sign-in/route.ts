import { NextResponse } from 'next/server'

import { loadPersonSignInDetails } from '@/lib/people/person-sign-in-details'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/users/<id>/sign-in: a person's sign-in for their sheet (admins). */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/users/[userId]/sign-in'>
) {
  const { user, denied } = await authorizeRoute('settings.users')
  if (denied) return denied
  const { userId } = await params
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid sign-in.' },
      { status: 400 }
    )
  }
  const data = await loadPersonSignInDetails(user, userId)
  return NextResponse.json({ ok: true, data })
}
