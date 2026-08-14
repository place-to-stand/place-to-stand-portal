import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { listLeadUpdates } from '@/lib/queries/lead-updates'

/**
 * GET /api/leads/[leadId]/updates
 *
 * Timeline rows for one lead, newest first.
 * Admin-only endpoint, mirroring the sibling tasks route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { leadId } = await params

  try {
    const updates = await listLeadUpdates(user, leadId)

    return NextResponse.json({ updates })
  } catch (error) {
    console.error('Failed to fetch lead updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch updates' },
      { status: 500 }
    )
  }
}
