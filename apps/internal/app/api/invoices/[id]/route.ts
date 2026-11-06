import { NextResponse } from 'next/server'

import { UUID_PATTERN } from '@/lib/sheets/entities'
import { authorizeRoute } from '@/lib/auth/guard'
import { getInvoiceById } from '@/lib/queries/invoices'

/**
 * GET /api/invoices/<id>: the invoice with its line items, for the invoice
 * sheet. 404 when there is no such invoice.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/invoices/[id]'>
) {
  const { user, denied } = await authorizeRoute('billing.manage')
  if (denied) return denied
  const { id } = await params
  const data = UUID_PATTERN.test(id) ? await getInvoiceById(user, id) : null
  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Invoice not found.' },
      { status: 404 }
    )
  }
  return NextResponse.json({ ok: true, data })
}
