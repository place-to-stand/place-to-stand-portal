import { NextResponse } from 'next/server'

import { listConnectedApps } from '@/lib/mcp/grants'
import { authorizeRoute } from '@/lib/auth/guard'

/** Apps the signed-in admin has connected through the MCP (PRD 009 §6). */
export async function GET() {
  const { denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied

  try {
    return NextResponse.json({ ok: true, data: await listConnectedApps() })
  } catch (error) {
    console.error('Unable to list connected apps', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to load connected apps.' },
      { status: 502 }
    )
  }
}
