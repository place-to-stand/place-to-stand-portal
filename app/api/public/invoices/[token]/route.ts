import { NextResponse } from 'next/server'

import { validateToken } from '@/lib/sharing/tokens'
import { fetchInvoiceByShareToken } from '@/lib/queries/invoices'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!validateToken(token)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid token.' },
        { status: 400 }
      )
    }

    const invoice = await fetchInvoiceByShareToken(token)
    if (!invoice) {
      return NextResponse.json(
        { ok: false, error: 'Invoice not found or sharing is disabled.' },
        { status: 404 }
      )
    }

    // Return only public-safe fields
    const publicData = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      notes: invoice.notes,
      clientName: invoice.client.name,
      lineItems: invoice.lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        type: li.type,
      })),
    }

    return NextResponse.json({ ok: true, data: publicData })
  } catch (err) {
    console.error('[public/invoices] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
