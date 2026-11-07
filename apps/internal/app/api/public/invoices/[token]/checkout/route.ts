// permission: public — unguessable share token
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { allowInvoiceCheckout } from '@/lib/auth/throttle'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'

const TOKEN_REGEX = /^[a-f0-9]{32}$/

/** Statuses in which the client can still complete the existing intent. */
const REUSABLE_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  'requires_payment_method',
  'requires_confirmation',
])

function paymentInProgress() {
  return NextResponse.json(
    {
      ok: false,
      error:
        'A payment for this invoice is already going through. Refresh the page in a few minutes.',
    },
    { status: 409 }
  )
}

/** The stored intent, or null when Stripe no longer has it. */
async function retrieveIntent(
  id: string
): Promise<Stripe.PaymentIntent | null> {
  try {
    return await getStripe().paymentIntents.retrieve(id)
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return null
    }
    throw err
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext<'/api/public/invoices/[token]/checkout'>
) {
  try {
    const { token } = await params

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid token.' },
        { status: 400 }
      )
    }

    if (!(await allowInvoiceCheckout(token))) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 }
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

    const totalCents = Math.round(Number(invoice.total) * 100)

    // If a payment intent already exists, reuse it when it still charges
    // this invoice's total (an edit may have changed it). Otherwise cancel it
    // before making a new one. An intent that is settling, or that Stripe
    // won't let us cancel, may still be paid, so we never replace it: the
    // client would be charged twice, or charged for an intent nothing tracks.
    if (invoice.stripePaymentIntentId) {
      const existing = await retrieveIntent(invoice.stripePaymentIntentId)

      if (existing) {
        const matchesInvoice =
          existing.payment_method_types?.length === 1 &&
          existing.payment_method_types[0] === 'card' &&
          existing.amount === totalCents &&
          existing.currency === 'usd'

        if (matchesInvoice && REUSABLE_STATUSES.has(existing.status)) {
          return NextResponse.json({
            ok: true,
            data: { clientSecret: existing.client_secret },
          })
        }

        if (
          existing.status === 'processing' ||
          existing.status === 'succeeded'
        ) {
          return paymentInProgress()
        }

        if (existing.status !== 'canceled') {
          try {
            await getStripe().paymentIntents.cancel(existing.id)
          } catch (err) {
            console.error(
              '[api/public/invoices/checkout] Could not cancel the earlier payment intent',
              { invoiceId: invoice.id, paymentIntentId: existing.id, err }
            )
            return paymentInProgress()
          }
        }
      }
    }

    const invoiceLabel = invoice.invoiceNumber
      ? `Invoice ${invoice.invoiceNumber}`
      : 'Invoice Payment'

    // Create PaymentIntent
    const subtotalCents = Math.round(Number(invoice.subtotal) * 100)
    const taxAmountCents = Math.round(Number(invoice.taxAmount) * 100)
    const taxRatePercent = invoice.taxRate
      ? (Number(invoice.taxRate) * 100).toString()
      : '0'

    const paymentIntent = await getStripe().paymentIntents.create(
      {
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
      },
      {
        // Two clicks at once read the same row, so they get the same intent
        // instead of two. Any later write to the invoice changes the key.
        idempotencyKey: `invoice-checkout:${invoice.id}:${totalCents}:${invoice.stripePaymentIntentId ?? 'none'}:${invoice.updatedAt}`,
      }
    )

    // Store payment intent ID on invoice for reuse and webhook lookup. Only
    // while the invoice is still payable and unchanged: a void, revert,
    // archive or edit that ran meanwhile stopped the payments it could see,
    // and could not see this one, so it is cancelled instead.
    const stored = await db
      .update(invoices)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(invoices.id, invoice.id),
          inArray(invoices.status, ['SENT', 'VIEWED']),
          isNull(invoices.deletedAt),
          // An edit meanwhile may have changed what the intent should charge.
          eq(invoices.total, invoice.total),
          // A second click at once gets the same intent (idempotency key)
          // and finds it already stored.
          sql`(${invoices.stripePaymentIntentId} is not distinct from ${invoice.stripePaymentIntentId} or ${invoices.stripePaymentIntentId} = ${paymentIntent.id})`
        )
      )
      .returning({ id: invoices.id })

    if (stored.length === 0) {
      try {
        await getStripe().paymentIntents.cancel(paymentIntent.id)
      } catch (err) {
        console.error(
          '[api/public/invoices/checkout] Could not cancel an intent for an invoice that changed',
          { invoiceId: invoice.id, paymentIntentId: paymentIntent.id, err }
        )
      }
      return NextResponse.json(
        {
          ok: false,
          error: 'This invoice changed. Refresh the page and try again.',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: { clientSecret: paymentIntent.client_secret },
    })
  } catch (err) {
    console.error('[api/public/invoices/checkout] Unhandled error:', err)
    return NextResponse.json(
      {
        ok: false,
        error: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    )
  }
}
