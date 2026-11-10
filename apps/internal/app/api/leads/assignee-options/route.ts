import { NextResponse } from 'next/server'

import { loadLeadAssigneeOptions } from '@/lib/assignees/options'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/leads/assignee-options: who a lead's "Set assignee" offers. */
export async function GET() {
  const { denied } = await authorizeRoute('leads.manage')
  if (denied) return denied
  return NextResponse.json({ ok: true, data: await loadLeadAssigneeOptions() })
}
