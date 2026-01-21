import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { fetchProposalsByLeadId } from '@/lib/queries/proposals'

/**
 * GET /api/leads/[leadId]/proposals
 *
 * Fetches all proposals linked to a specific lead.
 * Admin-only endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  await requireRole('ADMIN')
  const { leadId } = await params

  try {
    const proposals = await fetchProposalsByLeadId(leadId)

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('Failed to fetch lead proposals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}
