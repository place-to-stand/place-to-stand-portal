import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'

import { getCurrentUser } from '@/lib/auth/session'
import { getEnv } from '@/lib/env.server'

/**
 * GET /api/github/install?projectId=xxx
 *
 * Generates a CSRF state token, stores it in a cookie,
 * and redirects to the GitHub App installation page.
 * Optionally stores projectId for post-install redirect.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  getEnv() // validate env vars are present
  const state = nanoid(32)

  const cookieStore = await cookies()

  // Store state in a signed cookie for CSRF verification in callback
  cookieStore.set('github_app_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  // Store projectId and optional returnTo for redirect after callback
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')
  if (projectId) {
    cookieStore.set('github_app_return_project', projectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
  }

  const returnTo = url.searchParams.get('returnTo')
  if (returnTo) {
    cookieStore.set('github_app_return_to', returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
  }

  // Redirect to GitHub App installation page
  const installUrl = `https://github.com/apps/place-to-stand/installations/new?state=${state}`

  return NextResponse.redirect(installUrl)
}
