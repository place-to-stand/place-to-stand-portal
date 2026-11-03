import { NextResponse } from 'next/server'

import { listExternalProjectsForUser } from '@/lib/integrations/connections'
import {
  integrationErrorResponse,
  resolveProviderParam,
} from '@/lib/integrations/route-helpers'
import { authorizeRoute } from '@/lib/auth/guard'

/** Every external project the signed-in staff member's tokens can see. */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/integrations/[provider]/projects'>
) {
  const { user, denied } = await authorizeRoute('integrations.manage')
  if (denied) return denied
  const resolved = resolveProviderParam((await params).provider)
  if ('response' in resolved) {
    return resolved.response
  }

  try {
    const projects = await listExternalProjectsForUser(
      user.id,
      resolved.provider
    )
    return NextResponse.json({ ok: true, data: projects })
  } catch (error) {
    return integrationErrorResponse(error)
  }
}
