import { NextResponse } from 'next/server'

import { listIntegrationConnections } from '@/lib/integrations/connections'
import { resolveProviderParam } from '@/lib/integrations/route-helpers'
import { authorizeRoute } from '@/lib/auth/guard'

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/integrations/[provider]/status'>
) {
  const { user, denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  const accounts = await listIntegrationConnections(user.id, resolved.provider)

  return NextResponse.json({
    connected: accounts.some(account => account.status === 'ACTIVE'),
    accounts,
  })
}
