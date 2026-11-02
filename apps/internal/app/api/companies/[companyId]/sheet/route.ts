import { NextResponse } from 'next/server'

import { requireCrmUser } from '@/lib/auth/session'
import { loadCompanySheet } from '@/lib/companies/sheet-loaders'
import { NEW_SHEET_VALUE } from '@/lib/sheets/entities'

/**
 * GET /api/companies/<id|new>/sheet: what the company sheet shows. `data` is
 * null when the company doesn't exist.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/companies/[companyId]/sheet'>
) {
  const user = await requireCrmUser()
  const { companyId } = await params
  const data = await loadCompanySheet(
    user,
    companyId === NEW_SHEET_VALUE ? null : companyId
  )
  return NextResponse.json({ ok: true, data })
}
