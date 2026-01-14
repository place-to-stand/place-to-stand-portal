import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { getSignature, updateSignature } from '@/lib/gmail/client'

type Params = Promise<{ sendAsEmail: string }>

/**
 * GET /api/integrations/gmail/signatures/[sendAsEmail]
 * Get signature for a specific send-as email address.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sendAsEmail } = await params
  const decodedEmail = decodeURIComponent(sendAsEmail)

  try {
    const settings = await getSignature(user.id, decodedEmail)

    return NextResponse.json({
      email: settings.sendAsEmail,
      displayName: settings.displayName,
      signature: settings.signature || '',
      isPrimary: settings.isPrimary || false,
    })
  } catch (err) {
    console.error('Failed to fetch signature:', err)
    return NextResponse.json(
      { error: 'Failed to fetch signature' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/integrations/gmail/signatures/[sendAsEmail]
 * Update signature for a specific send-as email address.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sendAsEmail } = await params
  const decodedEmail = decodeURIComponent(sendAsEmail)

  const body = await request.json()
  const { signature } = body

  if (typeof signature !== 'string') {
    return NextResponse.json(
      { error: 'signature must be a string' },
      { status: 400 }
    )
  }

  try {
    const updated = await updateSignature(user.id, decodedEmail, signature)

    return NextResponse.json({
      email: updated.sendAsEmail,
      displayName: updated.displayName,
      signature: updated.signature || '',
      isPrimary: updated.isPrimary || false,
    })
  } catch (err) {
    console.error('Failed to update signature:', err)
    return NextResponse.json(
      { error: 'Failed to update signature' },
      { status: 500 }
    )
  }
}
