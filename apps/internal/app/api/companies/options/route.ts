import { NextResponse } from 'next/server'

import { requireCrmUser } from '@/lib/auth/session'
import { listCompanyOptions } from '@/lib/queries/companies'

/** GET /api/companies/options: every live company, for the company pickers. */
export async function GET() {
  const user = await requireCrmUser()
  return NextResponse.json({ ok: true, data: await listCompanyOptions(user) })
}
