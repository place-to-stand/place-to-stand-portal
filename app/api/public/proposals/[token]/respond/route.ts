import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { respondToProposal } from '@/lib/data/proposals'
import { fetchProposalByShareToken } from '@/lib/queries/proposals'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Verify the proposal exists and is shared
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: 'Proposal not found or sharing is disabled.' },
      { status: 404 }
    )
  }

  // If password-protected, verify cookie
  if (proposal.sharePasswordHash) {
    const cookieStore = await cookies()
    const verified = cookieStore.get(`proposal_verified_${token}`)
    if (verified?.value !== 'true') {
      return NextResponse.json(
        { ok: false, error: 'Password verification required.' },
        { status: 401 }
      )
    }
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as string
  const comment = typeof body.comment === 'string' ? body.comment : null

  if (action !== 'ACCEPTED' && action !== 'REJECTED') {
    return NextResponse.json(
      { ok: false, error: 'Action must be ACCEPTED or REJECTED.' },
      { status: 400 }
    )
  }

  const updated = await respondToProposal(token, action, comment)

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: 'This proposal has already been responded to.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ ok: true, data: { status: updated.status } })
}
