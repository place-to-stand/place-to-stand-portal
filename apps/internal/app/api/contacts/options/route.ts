import { NextResponse } from 'next/server'

import { listContactOptions } from '@/lib/queries/contacts/options'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/contacts/options: every live person, for the person pickers. */
export async function GET() {
  const { user, denied } = await authorizeRoute('contacts.manage')
  if (denied) return denied
  return NextResponse.json({ ok: true, data: await listContactOptions(user) })
}
