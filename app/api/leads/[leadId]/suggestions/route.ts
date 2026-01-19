import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { getSuggestionsForLead } from '@/lib/queries/suggestions'

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    await requireRole('ADMIN')

    const { leadId } = await context.params

    const suggestions = await getSuggestionsForLead(leadId)

    return NextResponse.json({ ok: true, suggestions })
  } catch (error) {
    console.error('Error fetching lead suggestions:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    )
  }
}
