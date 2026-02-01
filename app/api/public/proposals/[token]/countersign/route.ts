import { NextResponse } from 'next/server'

import { countersignProposal } from '@/lib/data/proposals'

const TOKEN_REGEX = /^[a-f0-9]{64}$/
const MAX_SIGNATURE_DATA_LENGTH = 500_000

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ ok: false, error: 'Invalid token.' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 })
    }

    const countersignerName = typeof body.countersignerName === 'string' ? body.countersignerName.trim() : ''
    const countersignerEmail = typeof body.countersignerEmail === 'string' ? body.countersignerEmail.trim() : ''
    const countersignatureData = typeof body.countersignatureData === 'string' ? body.countersignatureData : ''
    const countersignatureConsent = body.countersignatureConsent === true

    if (!countersignerName || !countersignatureData || !countersignatureConsent) {
      return NextResponse.json(
        { ok: false, error: 'Name, signature, and consent are required.' },
        { status: 400 }
      )
    }

    if (countersignatureData.length > MAX_SIGNATURE_DATA_LENGTH) {
      return NextResponse.json(
        { ok: false, error: 'Signature data exceeds maximum size.' },
        { status: 400 }
      )
    }

    const forwarded = request.headers.get('x-forwarded-for')
    const countersignerIpAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown'

    const updated = await countersignProposal(token, {
      countersignerName,
      countersignerEmail,
      countersignatureData,
      countersignerIpAddress,
      countersignatureConsent,
    })

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'This proposal has already been countersigned or is not eligible.' },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, data: { countersignedAt: updated.countersignedAt } })
  } catch (err) {
    console.error('[public/proposals/countersign] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
