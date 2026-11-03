import { NextResponse } from 'next/server'

import { loadCompanyClientWork } from '@/lib/companies/sheet-loaders'
import { authorizeRoute } from '@/lib/auth/guard'

/**
 * GET /api/companies/<id>/client-work: a client company's projects and
 * hours, for the sheet's Client column (admins). `data` is null for a
 * company that was never a client.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/companies/[companyId]/client-work'>
) {
  const { user, denied } = await authorizeRoute('clients.manage')
  if (denied) return denied
  const { companyId } = await params
  const data = await loadCompanyClientWork(user, companyId)
  return NextResponse.json({ ok: true, data })
}
