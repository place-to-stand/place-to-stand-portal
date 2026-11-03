import { NextResponse } from 'next/server'

import { getContactSheetData } from '@/lib/queries/contacts'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { authorizeRoute } from '@/lib/auth/guard'

/** GET /api/contacts/<id>/sheet: the person sheet's companies and photo. */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/contacts/[contactId]/sheet'>
) {
  const { user, denied } = await authorizeRoute('contacts.manage')
  if (denied) return denied
  const { contactId } = await params
  if (!UUID_PATTERN.test(contactId)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid person.' },
      { status: 400 }
    )
  }
  const data = await getContactSheetData(user, contactId)
  return NextResponse.json({ ok: true, data })
}
