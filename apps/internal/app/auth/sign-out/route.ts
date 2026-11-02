// permission: public — signs out whoever calls it
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Ends a session that has no active user behind it (their sign-in was turned
 * off, or the account no longer exists) and shows the sign-in page.
 *
 * Without this, a still-valid session for an unknown user loops: the page
 * sends it to /sign-in, and the proxy sends any signed-in visitor at /sign-in
 * back home. Signing out here clears the session cookie, so /sign-in renders.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient()
  // This browser only: the account may still be valid elsewhere.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)

  const signIn = new URL('/sign-in', request.url)
  signIn.searchParams.set('notice', 'signed-out')
  return NextResponse.redirect(signIn)
}
