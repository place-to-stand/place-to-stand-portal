import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ensureUserProfile } from '@/lib/auth/profile'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Handles email confirmation callbacks from Supabase.
 * When a user clicks a confirmation link (e.g., for email change),
 * Supabase redirects them here with a token_hash and type parameter.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const redirectTo = searchParams.get('redirect_to') ?? '/'

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url))
  }

  // Only accept the types we actually issue, rather than casting whatever arrives.
  if (!isSupportedOtpType(type)) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid_link', request.url))
  }

  const supabase = getSupabaseServerClient()

  // Exchange the token hash for a session
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })

  if (error) {
    console.error('Failed to verify email confirmation token', error)
    return NextResponse.redirect(
      new URL('/sign-in?error=confirmation_failed', request.url)
    )
  }

  // Sync the updated user profile to the database
  if (data.user) {
    const result = await ensureUserProfile(data.user)

    if (result === 'not_provisioned') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/account-not-set-up', request.url))
    }
  }

  // For email changes, redirect to a success page or the dashboard
  if (type === 'email_change') {
    return NextResponse.redirect(
      new URL('/?email_changed=true', request.url)
    )
  }

  // For password recovery, redirect to the reset form so the user can set a new password
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', request.url))
  }

  // Relative paths only. Without this, `?redirect_to=//evil.com` resolves to an
  // absolute off-site URL — the same guard the sibling callback route already applies.
  const safePath =
    redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'

  return NextResponse.redirect(new URL(safePath, request.url))
}

const SUPPORTED_OTP_TYPES = [
  'email_change',
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email',
] as const

type SupportedOtpType = (typeof SUPPORTED_OTP_TYPES)[number]

function isSupportedOtpType(value: string): value is SupportedOtpType {
  return (SUPPORTED_OTP_TYPES as readonly string[]).includes(value)
}
