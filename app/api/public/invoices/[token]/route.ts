import { NextResponse } from 'next/server'

import { fetchInvoiceByShareToken } from '@/lib/queries/invoices'
import { markInvoiceViewed } from '@/lib/data/invoices'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invoice = await fetchInvoiceByShareToken(token)
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Record view (SENT → VIEWED transition, guarded)
  await markInvoiceViewed(invoice.id)

  // Return safe public data (strip internal fields)
  return NextResponse.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes,
    client: invoice.client
      ? { name: invoice.client.name }
      : null,
    lineItems: invoice.lineItems.map(item => ({
      id: item.id,
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      sortOrder: item.sortOrder,
    })),
  })
}
