import { NextResponse } from 'next/server'

import { loadTimeLogHours } from '@/lib/projects/time-log/load-time-log-hours'

/**
 * GET /api/projects/<id>/time-log-hours: the hours every time-log dialog
 * shows. `data` is null for projects with no client, and for non-admins.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/projects/[projectId]/time-log-hours'>
) {
  const { projectId } = await params
  const data = await loadTimeLogHours(projectId)
  return NextResponse.json({ ok: true, data })
}
