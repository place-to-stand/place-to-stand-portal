import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

import { verifySharePassword } from '@/lib/data/proposals'

const TOKEN_REGEX = /^[a-f0-9]{32}$/

function signToken(token: string): string {
  const secret = process.env.COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback-dev-secret'
  return createHmac('sha256', secret).update(token).digest('hex')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON in request body.' }, { status: 400 })
    }

    const password = typeof body.password === 'string' ? body.password : undefined

    const result = await verifySharePassword(token, password)

    if (!result.ok) {
      const status = result.needsPassword ? 401 : 404
      const error = result.needsPassword ? 'Invalid password.' : 'Proposal not found.'
      return NextResponse.json({ ok: false, error }, { status })
    }

    // Set HMAC-signed cookie so the value can't be forged
    const cookieStore = await cookies()
    cookieStore.set(`proposal_verified_${token}`, signToken(token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[public/proposals/verify] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
