import { NextResponse } from 'next/server'

import { validateToken } from '@/lib/sharing/tokens'
import { fetchInvoiceByShareToken, updateInvoice } from '@/lib/queries/invoices'
import {
  createPaymentIntent,
  getPaymentIntent,
} from '@/lib/integrations/stripe/payment-intents'

export async function POST(
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

    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { ok: false, error: 'This invoice has already been paid.' },
        { status: 400 }
      )
    }

    if (invoice.status === 'VOID') {
      return NextResponse.json(
        { ok: false, error: 'This invoice has been voided.' },
        { status: 400 }
      )
    }

    // If a PI already exists, retrieve it instead of creating a new one
    if (invoice.stripePaymentIntentId) {
      const existingPi = await getPaymentIntent(invoice.stripePaymentIntentId)
      if (existingPi.status !== 'canceled') {
        return NextResponse.json({
          ok: true,
          data: { clientSecret: existingPi.client_secret },
        })
      }
    }

    // Create new PaymentIntent
    const amountInCents = Math.round(Number(invoice.total) * 100)
    const pi = await createPaymentIntent({
      amountInCents,
      currency: invoice.currency,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber ?? '',
        client_name: invoice.client.name,
      },
    })

    // Store the PI ID on the invoice
    await updateInvoice(invoice.id, {
      stripePaymentIntentId: pi.id,
    })

    return NextResponse.json({
      ok: true,
      data: { clientSecret: pi.client_secret },
    })
  } catch (err) {
    console.error('[public/invoices/pay] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to create payment. Please try again.' },
      { status: 500 }
    )
  }
}
