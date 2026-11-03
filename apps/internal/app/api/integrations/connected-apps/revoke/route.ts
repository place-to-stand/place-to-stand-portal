import { NextResponse } from 'next/server'
import { z } from 'zod'

import { revokeConnectedApp } from '@/lib/mcp/grants'
import { authorizeRoute } from '@/lib/auth/guard'

const bodySchema = z.object({ clientId: z.string().uuid() })

export async function POST(request: Request) {
  const { denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'clientId is required' },
      { status: 400 }
    )
  }

  try {
    await revokeConnectedApp(parsed.data.clientId)
  } catch (error) {
    console.error('Unable to revoke connected app', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to revoke the app. Try again.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
