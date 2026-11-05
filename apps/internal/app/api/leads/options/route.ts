import { NextResponse } from 'next/server'

import { loadLeadOptions } from '@/lib/data/projects/relations/task-leads'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/leads/options: every live lead, for the task sheet's picker. */
export async function GET() {
  const { denied } = await authorizeRoute('leads.tasks')
  if (denied) return denied
  return NextResponse.json({ ok: true, data: await loadLeadOptions() })
}
