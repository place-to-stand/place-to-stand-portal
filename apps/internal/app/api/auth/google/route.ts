import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requirePage } from '@/lib/auth/session'
import { roleCan } from '@/lib/auth/capabilities'
import {
  getGoogleAuthUrl,
  GOOGLE_READ_MAIL_SCOPES,
  GOOGLE_SCOPES,
} from '@/lib/oauth/google'
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
  const user = await requirePage('integrations.google')

  const state = await generateOAuthState()
  await setOAuthReturnTo(
    safeReturnPath(request.nextUrl.searchParams.get('returnTo'))
  )
  // Agency integrations (Calendar, Drive, sending) are admin-only, so
  // everyone else is asked for read-only Gmail and nothing more.
  const authUrl = getGoogleAuthUrl(
    state,
    roleCan(user.role, 'integrations.manage')
      ? GOOGLE_SCOPES
      : GOOGLE_READ_MAIL_SCOPES
  )

  return NextResponse.redirect(authUrl)
}
