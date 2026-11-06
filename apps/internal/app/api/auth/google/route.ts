import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requirePage } from '@/lib/auth/session'
import { getGoogleAuthUrl } from '@/lib/oauth/google'
import {
  generateOAuthState,
  safeReturnPath,
  setOAuthReturnTo,
} from '@/lib/oauth/state'

/**
 * Starts connecting the signed-in person's own Google account. Admins come
 * from Settings → Integrations; anyone else from the lead sheet's Emails
 * section, which passes `returnTo` so the callback lands back on the lead.
 */
export async function GET(request: NextRequest) {
  await requirePage('integrations.google')

  const state = await generateOAuthState()
  await setOAuthReturnTo(
    safeReturnPath(request.nextUrl.searchParams.get('returnTo'))
  )
  const authUrl = getGoogleAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
