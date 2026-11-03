import { NextResponse } from 'next/server'

import { listCompanyOptions } from '@/lib/queries/companies'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/companies/options: every live company, for the company pickers. */
export async function GET() {
  const { user, denied } = await authorizeRoute('companies.manage')
  if (denied) return denied
  return NextResponse.json({ ok: true, data: await listCompanyOptions(user) })
}
