import { NextResponse } from 'next/server'

import { fetchInvoiceByShareToken, updateInvoice } from '@/lib/queries/invoices'
import { createPaymentIntent } from '@/lib/integrations/stripe/payment-intents'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const invoice = await fetchInvoiceByShareToken(token)
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Don't allow payment on terminal statuses
  if (['PAID', 'VOID', 'REFUNDED'].includes(invoice.status)) {
    return NextResponse.json(
      { error: 'Invoice cannot be paid' },
      { status: 400 }
    )
  }

  // If we already have a payment intent, return its client secret
  if (invoice.stripePaymentIntentId) {
    const { getPaymentIntent } = await import(
      '@/lib/integrations/stripe/payment-intents'
    )
    const existingIntent = await getPaymentIntent(invoice.stripePaymentIntentId)
    return NextResponse.json({
      clientSecret: existingIntent.client_secret,
      paymentIntentId: existingIntent.id,
    })
  }

  // Create new payment intent
  const totalCents = Math.round(Number(invoice.total) * 100)
  if (totalCents <= 0) {
    return NextResponse.json(
      { error: 'Invoice total must be greater than 0' },
      { status: 400 }
    )
  }

  const paymentIntent = await createPaymentIntent({
    amountCents: totalCents,
    currency: invoice.currency ?? 'usd',
    invoiceId: invoice.id,
    clientName: invoice.client?.name,
    invoiceNumber: invoice.invoiceNumber,
  })

  // Store payment intent ID on invoice
  await updateInvoice(invoice.id, {
    stripePaymentIntentId: paymentIntent.id,
    stripePaymentStatus: paymentIntent.status,
  })

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  })
}
