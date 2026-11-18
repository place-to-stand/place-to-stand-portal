import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requirePage } from '@/lib/auth/session'
import { getGitHubAuthUrl } from '@/lib/oauth/github'
import {
  generateOAuthState,
  safeReturnPath,
  setOAuthReturnTo,
} from '@/lib/oauth/state'

export async function GET(request: NextRequest) {
  // Anyone on staff connects their own GitHub (Account → Integrations).
  await requirePage('integrations.personal')

  const state = await generateOAuthState()
  await setOAuthReturnTo(
    safeReturnPath(request.nextUrl.searchParams.get('returnTo'))
  )
  const authUrl = getGitHubAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
