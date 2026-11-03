import { NextResponse } from 'next/server'
import { z } from 'zod'

import { disconnectIntegration } from '@/lib/integrations/connections'
import { resolveProviderParam } from '@/lib/integrations/route-helpers'
import { authorizeRoute } from '@/lib/auth/guard'

const bodySchema = z.object({ connectionId: z.string().uuid() })

export async function POST(
  request: Request,
  { params }: RouteContext<'/api/integrations/[provider]/disconnect'>
) {
  const { user, denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'connectionId is required' },
      { status: 400 }
    )
  }

  const removed = await disconnectIntegration(
    user,
    resolved.provider,
    parsed.data.connectionId
  )
  if (!removed) {
    return NextResponse.json(
      { ok: false, error: 'Connection not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, success: true })
}
