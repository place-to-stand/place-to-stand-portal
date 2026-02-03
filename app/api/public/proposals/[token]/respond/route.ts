import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { respondToProposal } from '@/lib/data/proposals'
import { fetchProposalByShareToken } from '@/lib/queries/proposals'
import type { SignatureData } from '@/lib/queries/proposals'
import { verifyTokenSignature, isValidSignatureDataUrl } from '@/lib/auth/crypto'

const TOKEN_REGEX = /^[a-f0-9]{32}$/
const MAX_COMMENT_LENGTH = 2000
const MAX_SIGNATURE_DATA_LENGTH = 500_000 // ~375KB base64 PNG

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 })
    }

    // Verify the proposal exists and is shared
    const proposal = await fetchProposalByShareToken(token)
    if (!proposal) {
      return NextResponse.json(
        { ok: false, error: 'Proposal not found or sharing is disabled.' },
        { status: 404 }
      )
    }

    // If password-protected, verify HMAC-signed cookie
    if (proposal.sharePasswordHash) {
      const cookieStore = await cookies()
      const verified = cookieStore.get(`proposal_verified_${token}`)
      if (!verified?.value || !verifyTokenSignature(token, verified.value)) {
        return NextResponse.json(
          { ok: false, error: 'Password verification required.' },
          { status: 401 }
        )
      }
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON in request body.' }, { status: 400 })
    }

    const action = body.action as string
    const comment = typeof body.comment === 'string'
      ? body.comment.slice(0, MAX_COMMENT_LENGTH)
      : null

    if (action !== 'ACCEPTED' && action !== 'REJECTED') {
      return NextResponse.json(
        { ok: false, error: 'Action must be ACCEPTED or REJECTED.' },
        { status: 400 }
      )
    }

    // Validate signature fields for acceptance
    let signature: SignatureData | null = null
    if (action === 'ACCEPTED') {
      const signerName = typeof body.signerName === 'string' ? body.signerName.trim() : ''
      const signerEmail = typeof body.signerEmail === 'string' ? body.signerEmail.trim() : ''
      const signatureData = typeof body.signatureData === 'string' ? body.signatureData : ''
      const signatureConsent = body.signatureConsent === true

      if (!signerName || !signatureData || !signatureConsent) {
        return NextResponse.json(
          { ok: false, error: 'Signature, signer name, and consent are required to accept.' },
          { status: 400 }
        )
      }

      if (signatureData.length > MAX_SIGNATURE_DATA_LENGTH) {
        return NextResponse.json(
          { ok: false, error: 'Signature data exceeds maximum size.' },
          { status: 400 }
        )
      }

      if (!isValidSignatureDataUrl(signatureData)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid signature format. Must be a PNG image.' },
          { status: 400 }
        )
      }

      const forwarded = request.headers.get('x-forwarded-for')
      const signerIpAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown'

      signature = {
        signerName,
        signerEmail,
        signatureData,
        signerIpAddress,
        signatureConsent,
      }
    }

    const updated = await respondToProposal(token, action, comment, signature)

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'This proposal has already been responded to.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, data: { status: updated.status } })
  } catch (err) {
    console.error('[public/proposals/respond] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
