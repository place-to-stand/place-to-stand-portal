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

  const supabase = getSupabaseServerClient()

  // Exchange the token hash for a session
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'email_change' | 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email',
  })

  if (error) {
    console.error('Failed to verify email confirmation token', error)
    return NextResponse.redirect(
      new URL('/sign-in?error=confirmation_failed', request.url)
    )
  }

  // Sync the updated user profile to the database
  if (data.user) {
    await ensureUserProfile(data.user)

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

  // For password recovery, redirect to the reset form so the user can set a new password
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', request.url))
  }

  return NextResponse.redirect(new URL(redirectTo, request.url))
}
