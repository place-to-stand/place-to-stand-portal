import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { fetchProposalByShareToken } from '@/lib/queries/proposals'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const proposal = await fetchProposalByShareToken(token)

  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: 'Proposal not found or sharing is disabled.' },
      { status: 404 }
    )
  }

  // If password-protected, check for verification cookie
  if (proposal.sharePasswordHash) {
    const cookieStore = await cookies()
    const verified = cookieStore.get(`proposal_verified_${token}`)
    if (verified?.value !== 'true') {
      return NextResponse.json({
        ok: true,
        data: { needsPassword: true, title: proposal.title },
      })
    }
  }

  // Strip sensitive fields before sending to public client
  const { sharePasswordHash: _, shareToken: __, ...publicData } = proposal

  return NextResponse.json({ ok: true, data: { needsPassword: false, proposal: publicData } })
}
