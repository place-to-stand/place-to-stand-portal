import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listConnectedApps } from '@/lib/mcp/grants'

/** Apps the signed-in admin has connected through the MCP (PRD 009 §6). */
export async function GET() {
  await requireUser()

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
