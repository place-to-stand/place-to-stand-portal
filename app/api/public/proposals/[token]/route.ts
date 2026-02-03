import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { fetchProposalByShareToken } from '@/lib/queries/proposals'
import { verifyTokenSignature } from '@/lib/auth/crypto'

const TOKEN_REGEX = /^[a-f0-9]{32}$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 })
    }

    const proposal = await fetchProposalByShareToken(token)

    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: 'Proposal not found or sharing is disabled.' },
        { status: 404 }
      )
    }

    // If password-protected, check for HMAC-signed verification cookie
    if (proposal.sharePasswordHash) {
      const cookieStore = await cookies()
      const verified = cookieStore.get(`proposal_verified_${token}`)
      if (!verified?.value || !verifyTokenSignature(token, verified.value)) {
        return NextResponse.json({
          ok: true,
          data: { needsPassword: true, title: proposal.title },
        })
      }
    }

    // Return only public-safe fields (allowlist, not blocklist)
    const publicData = {
      title: proposal.title,
      content: proposal.content,
      estimatedValue: proposal.estimatedValue,
      expirationDate: proposal.expirationDate,
      status: proposal.status,
      acceptedAt: proposal.acceptedAt,
      rejectedAt: proposal.rejectedAt,
      clientComment: proposal.clientComment,
      signatureData: proposal.signatureData,
    }

    return NextResponse.json({ ok: true, data: { needsPassword: false, proposal: publicData } })
  } catch (err) {
    console.error('[public/proposals] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
