import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { verifySharePassword } from '@/lib/data/proposals'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json().catch(() => ({}))
  const password = typeof body.password === 'string' ? body.password : undefined

  const result = await verifySharePassword(token, password)

  if (!result.ok) {
    const status = result.needsPassword ? 401 : 404
    const error = result.needsPassword ? 'Invalid password.' : 'Proposal not found.'
    return NextResponse.json({ ok: false, error }, { status })
  }

  // Set a short-lived cookie (24h) so the client doesn't re-enter the password
  const cookieStore = await cookies()
  cookieStore.set(`proposal_verified_${token}`, 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
