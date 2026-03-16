import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { fetchMeetingsByLeadId } from '@/lib/queries/meetings'

/**
 * GET /api/leads/[leadId]/meetings
 *
 * Fetches all meetings linked to a specific lead.
 * Admin-only endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  await requireRole('ADMIN')
  const { leadId } = await params

  try {
    const meetings = await fetchMeetingsByLeadId(leadId)

    return NextResponse.json({ meetings })
  } catch (error) {
    console.error('Failed to fetch lead meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}
