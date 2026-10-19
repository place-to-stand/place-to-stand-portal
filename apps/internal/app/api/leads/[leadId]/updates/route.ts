import { NextResponse } from 'next/server'

import { requireCrmUser } from '@/lib/auth/session'
import { listLeadUpdates } from '@/lib/queries/lead-updates'

/**
 * GET /api/leads/[leadId]/updates
 *
 * Timeline rows for one lead, newest first.
 * CRM endpoint (ADMIN, USER); the sibling tasks and conversion routes stay
 * admin-only.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/leads/[leadId]/updates'>
) {
  const user = await requireCrmUser()
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
