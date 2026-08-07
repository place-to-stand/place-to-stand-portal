import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  hasPortalProfile,
  isSupportedOtpType,
  safeRedirectPath,
} from '@/lib/auth/callback'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Token-hash verification for email links.
 *
 * Supabase delivers either a `code` (handled by `/auth/callback`) or a
 * `token_hash` + `type` pair depending on the template and how the link was
 * generated. Admin-generated invite links use the `token_hash` form, so the
 * portal needs both routes.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const redirectTo = request.nextUrl.searchParams.get('redirect_to') ?? '/'

  if (!tokenHash || !type || !isSupportedOtpType(type)) {
    return NextResponse.redirect(
      new URL('/sign-in?error=invalid_link', request.url)
    )
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error || !data.user) {
    console.error('Failed to verify auth token', error)
    return NextResponse.redirect(
      new URL('/sign-in?error=confirmation_failed', request.url)
    )
  }

  if (!(await hasPortalProfile(data.user.id))) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/account-not-set-up', request.url))
  }

  // Password recovery has to land on the form that sets a new one, otherwise the
  // session is spent getting them to a page that can't use it.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/force-reset-password', request.url))
  }

  return NextResponse.redirect(
    new URL(safeRedirectPath(redirectTo), request.url)
  )
}
