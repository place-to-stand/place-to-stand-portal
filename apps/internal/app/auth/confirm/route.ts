import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'

import { ensureUserProfile } from '@/lib/auth/profile'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
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

    // Two distinct rejections, deliberately not collapsed into one role check.
    // "No account" and "wrong app" are different facts and get different pages;
    // `profile?.role !== 'ADMIN'` alone would be true for both.
    if (result === 'not_provisioned') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/account-not-set-up', request.url))
    }

    // The internal portal is admin-only. Portal (CLIENT) users belong on the
    // client portal — drop the session and send them there.
    const [profile] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, data.user.id))
      .limit(1)

    if (profile?.role !== 'ADMIN') {
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL('/sign-in?notice=client-portal', request.url)
      )
    }
  }

  // For email changes, redirect to a success page or the dashboard
  if (type === 'email_change') {
    return NextResponse.redirect(
      new URL('/?email_changed=true', request.url)
    )
  }

  // Relative paths only. Without this, `?redirect_to=//evil.com` resolves to an
  // absolute off-site URL — the same guard the sibling callback route already applies.
  const safePath =
    redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'

  // Password recovery lands on the reset form, which is the only page that can
  // spend the session usefully. A caller may name a more specific target — the
  // form carries a post-reset `?redirect=` — but it is still relative-only, and
  // absent one this falls back to the form rather than the dashboard.
  if (type === 'recovery') {
    return NextResponse.redirect(
      new URL(safePath === '/' ? '/reset-password' : safePath, request.url)
    )
  }

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
