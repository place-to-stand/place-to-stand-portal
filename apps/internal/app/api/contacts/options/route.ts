import { NextResponse } from 'next/server'

import { requireCrmUser } from '@/lib/auth/session'
import { listContactOptions } from '@/lib/queries/contacts/options'

/** GET /api/contacts/options: every live person, for the person pickers. */
export async function GET() {
  const user = await requireCrmUser()
  return NextResponse.json({ ok: true, data: await listContactOptions(user) })
}
