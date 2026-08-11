import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { hasPortalProfile, safeRedirectPath } from '@/lib/auth/callback'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * PKCE code exchange for magic link and Google sign-in.
 *
 * Lives outside the `(auth)` and `(portal)` route groups on purpose: inside
 * `(portal)` the layout's `requireClientUser()` runs first and redirects to
 * `/sign-in` before the code is ever exchanged.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const redirectTo = request.nextUrl.searchParams.get('redirect_to') ?? '/'

  if (!code) {
    return NextResponse.redirect(
      new URL('/sign-in?error=missing_code', request.url)
    )
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('Failed to exchange auth code for session', error)
    return NextResponse.redirect(
      new URL('/sign-in?error=exchange_failed', request.url)
    )
  }

  if (!(await hasPortalProfile(data.user.id))) {
    // Signing out matters: without it the visitor holds a valid session that
    // resolves to no profile, and every request re-runs this redirect.
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/account-not-set-up', request.url))
  }

  return NextResponse.redirect(
    new URL(safeRedirectPath(redirectTo), request.url)
  )
}
