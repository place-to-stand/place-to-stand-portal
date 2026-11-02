import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { loadCompanyClientWork } from '@/lib/companies/sheet-loaders'

/**
 * GET /api/companies/<id>/client-work: a client company's projects and
 * hours, for the sheet's Client column (admins). `data` is null for a
 * company that was never a client.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/companies/[companyId]/client-work'>
) {
  const user = await requireUser()
  const { companyId } = await params
  const data = await loadCompanyClientWork(user, companyId)
  return NextResponse.json({ ok: true, data })
}
