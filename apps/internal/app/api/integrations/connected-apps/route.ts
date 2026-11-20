import { NextResponse } from 'next/server'

import { listConnectedApps } from '@/lib/mcp/grants'
import { authorizeRoute } from '@/lib/auth/guard'

/** Apps the signed-in person has connected through the MCP. */
export async function GET() {
  const { denied } = await authorizeRoute('integrations.personal')
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
