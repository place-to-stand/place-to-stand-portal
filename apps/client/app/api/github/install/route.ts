import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

import { getCurrentUser } from '@/lib/auth/session'
import { getEnv } from '@/lib/env.server'

/**
 * GET /api/github/install
 *
 * Generates a CSRF state token, stores it in a cookie,
 * and redirects to the GitHub App installation page.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const env = getEnv()
  const state = nanoid(32)

  // Store state in a signed cookie for CSRF verification in callback
  const cookieStore = await cookies()
  cookieStore.set('github_app_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Redirect to GitHub App installation page
  const installUrl = `https://github.com/apps/place-to-stand/installations/new?state=${state}`

  return NextResponse.redirect(installUrl)
}
