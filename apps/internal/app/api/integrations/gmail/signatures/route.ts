import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { getSendAsSettings } from '@/lib/gmail/client'

/**
 * GET /api/integrations/gmail/signatures
 * Get all send-as addresses and their signatures for the current user.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sendAsSettings = await getSendAsSettings(user.id)

    // Map to a simplified response
    const signatures = sendAsSettings.map(s => ({
      email: s.sendAsEmail,
      displayName: s.displayName,
      signature: s.signature || '',
      isPrimary: s.isPrimary || false,
      isDefault: s.isDefault || false,
    }))

    return NextResponse.json({ signatures })
  } catch (err) {
    console.error('Failed to fetch signatures:', err)
    return NextResponse.json(
      { error: 'Failed to fetch signatures' },
      { status: 500 }
    )
  }
}
