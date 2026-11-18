import { NextResponse } from 'next/server'

import { requirePage } from '@/lib/auth/session'
import { getGitHubAuthUrl } from '@/lib/oauth/github'
import { generateOAuthState } from '@/lib/oauth/state'

export async function GET() {
  // Anyone on staff connects their own GitHub (Account → Integrations).
  await requirePage('integrations.personal')

  const state = await generateOAuthState()
  const authUrl = getGitHubAuthUrl(state)

  return NextResponse.redirect(authUrl)
}
