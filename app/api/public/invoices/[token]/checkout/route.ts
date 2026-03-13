import { NextResponse } from 'next/server'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'

const TOKEN_REGEX = /^[a-f0-9]{32}$/

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid token.' },
        { status: 400 }
      )
    }

    // Fetch invoice by share token (no auth - token IS the auth)
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.shareToken, token),
          eq(invoices.shareEnabled, true),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1)

    if (!invoice) {
      return NextResponse.json(
        { ok: false, error: 'Invoice not found or sharing is disabled.' },
        { status: 404 }
      )
    }

    // Validate status
    if (invoice.status !== 'SENT' && invoice.status !== 'VIEWED') {
      return NextResponse.json(
        { ok: false, error: 'Invoice is not available for payment.' },
        { status: 400 }
      )
    }

    // If a payment intent already exists, try to reuse it
    if (invoice.stripePaymentIntentId) {
      try {
        const existingIntent = await getStripe().paymentIntents.retrieve(
          invoice.stripePaymentIntentId
        )
        const isReusable =
          (existingIntent.status === 'requires_payment_method' ||
            existingIntent.status === 'requires_confirmation') &&
          existingIntent.payment_method_types?.length === 1 &&
          existingIntent.payment_method_types[0] === 'card'

        if (isReusable) {
          return NextResponse.json({
            ok: true,
            data: { clientSecret: existingIntent.client_secret },
          })
        }

        // Cancel stale/mismatched intent before creating a new one
        if (
          existingIntent.status === 'requires_payment_method' ||
          existingIntent.status === 'requires_confirmation'
        ) {
          await getStripe().paymentIntents.cancel(
            invoice.stripePaymentIntentId
          )
        }
      } catch {
        // Intent no longer valid, create a new one
      }
    }

    const totalCents = Math.round(Number(invoice.total) * 100)
    const invoiceLabel = invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber}`
      : 'Invoice Payment'

    // Create PaymentIntent
    const subtotalCents = Math.round(Number(invoice.subtotal) * 100)
    const taxAmountCents = Math.round(Number(invoice.taxAmount) * 100)
    const taxRatePercent = invoice.taxRate
      ? (Number(invoice.taxRate) * 100).toString()
      : '0'

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      description: invoiceLabel,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? '',
        subtotal: subtotalCents.toString(),
        tax_amount: taxAmountCents.toString(),
        tax_rate_percent: taxRatePercent,
      },
      payment_method_types: ['card'],
    })

    // Store payment intent ID on invoice for reuse and webhook lookup
    await db
      .update(invoices)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoice.id))

    return NextResponse.json({
      ok: true,
      data: { clientSecret: paymentIntent.client_secret },
    })
  } catch (err) {
    console.error('[api/public/invoices/checkout] Unhandled error:', err)
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
