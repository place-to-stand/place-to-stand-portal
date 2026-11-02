// permission: public — verified by Stripe signature
import { NextResponse } from 'next/server'
import { and, eq, ne, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import {
  getInvoiceByStripeSession,
  getInvoiceByPaymentIntent,
} from '@/lib/queries/invoices'
import { invoicePaidEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { createHourBlocksFromInvoice } from '@/lib/data/invoices'
import { notifyInvoicePaid } from '@/lib/notifications/google-chat'
import {
  checkoutPaymentOutcome,
  coversTotal,
} from '@/lib/invoices/stripe-checkout-payment'

/**
 * Mark an invoice as paid, log activity, and create hour blocks.
 * Shared by both checkout.session.completed and payment_intent.succeeded handlers.
 *
 * Hour block creation is idempotent (ON CONFLICT DO NOTHING), so it runs
 * even when the invoice is already PAID — this ensures retried webhooks
 * can recover from a previous incomplete execution.
 */
/**
 * True when Stripe collected at least the invoice total (in cents, USD).
 * Logs and returns false otherwise, so a payment for a stale or tampered
 * amount never marks the invoice paid.
 */
function coversInvoiceTotal(
  invoice: { id: string; total: string | number | null },
  received: { amount: number | null; currency: string | null; source: string }
): boolean {
  const totalCents = Math.round(Number(invoice.total) * 100)
  const ok = coversTotal(invoice.total, received)
  if (!ok) {
    console.error(
      '[stripe-webhook] Payment does not cover the invoice total; not marking paid',
      {
        invoiceId: invoice.id,
        source: received.source,
        totalCents,
        received: received.amount,
        currency: received.currency,
      }
    )
  }
  return ok
}

async function markInvoicePaid(
  invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceByStripeSession>>>,
  paymentIntentId: string | null
) {
  // Only the delivery that flips the status logs and notifies: the update is
  // conditional, so a replayed or concurrent event finds it already paid.
  const flipped =
    invoice.status === 'PAID'
      ? []
      : await db
          .update(invoices)
          .set({
            status: 'PAID',
            stripePaymentIntentId: paymentIntentId,
            paidAt: sql`timezone('utc'::text, now())`,
            updatedAt: sql`timezone('utc'::text, now())`,
          })
          .where(and(eq(invoices.id, invoice.id), ne(invoices.status, 'PAID')))
          .returning({ id: invoices.id })
  if (flipped.length > 0) {
    // Awaited before the response goes out: a fire-and-forget promise here
    // can be cut off when the serverless function terminates.
    const paidEvent = invoicePaidEvent({
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      clientName: invoice.client?.name,
    })

    await logActivity({
      actorId: null,
      source: 'SYSTEM',
      verb: paidEvent.verb,
      summary: paidEvent.summary,
      targetType: 'INVOICE',
      targetId: invoice.id,
      targetCompanyId: invoice.company_id,
      metadata: paidEvent.metadata,
    })

    // Notify the team in Google Chat (fire-and-forget — non-critical).
    // Guarded by status !== 'PAID' so retried webhooks don't re-notify.
    notifyInvoicePaid({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      clientName: invoice.client?.name,
    }).catch(console.error)
  }

  // Always attempt hour block creation — must be awaited so it completes
  // before the serverless function terminates. Safe to run on retries
  // because the insert uses ON CONFLICT DO NOTHING.
  await createHourBlocksFromInvoice(invoice.id)
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json(
      { ok: false, error: 'Webhook not configured.' },
      { status: 500 }
    )
  }

  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { ok: false, error: 'Missing stripe-signature header.' },
      { status: 400 }
    )
  }

  let event

  try {
    const body = await request.text()
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Invalid signature:', err)
    return NextResponse.json(
      { ok: false, error: 'Invalid signature.' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      // PaymentIntent flow (Payment Element)
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object

        // Look up invoice by the payment intent ID stored on the invoice
        const invoice = await getInvoiceByPaymentIntent(paymentIntent.id)

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for payment_intent:',
            paymentIntent.id
          )
          return NextResponse.json({ ok: true, received: true })
        }

        if (
          !coversInvoiceTotal(invoice, {
            amount: paymentIntent.amount_received,
            currency: paymentIntent.currency,
            source: paymentIntent.id,
          })
        ) {
          return NextResponse.json({ ok: true, received: true })
        }

        await markInvoicePaid(invoice, paymentIntent.id)
        break
      }

      // Checkout Session flow (legacy / Embedded Checkout). A completed
      // session is paid only when payment_status is 'paid'; delayed methods
      // settle later with the async_payment events.
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object

        const invoiceId =
          session.metadata?.invoiceId ?? session.client_reference_id

        if (!invoiceId) {
          console.error(
            '[stripe-webhook] No invoiceId in session metadata or client_reference_id'
          )
          return NextResponse.json({ ok: true, received: true })
        }

        const invoice = await getInvoiceByStripeSession(session.id)

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for session:',
            session.id
          )
          return NextResponse.json({ ok: true, received: true })
        }

        const outcome = checkoutPaymentOutcome(
          event.type,
          session.payment_status
        )

        if (outcome === 'awaiting') {
          console.warn(
            '[stripe-webhook] Checkout completed but not paid yet; waiting for the async payment',
            { invoiceId: invoice.id, session: session.id }
          )
          return NextResponse.json({ ok: true, received: true })
        }

        if (outcome === 'failed') {
          console.warn('[stripe-webhook] Delayed payment failed', {
            invoiceId: invoice.id,
            session: session.id,
          })
          // Let the client start a new checkout; the invoice stays unpaid.
          if (invoice.status !== 'PAID') {
            await db
              .update(invoices)
              .set({
                stripeCheckoutSessionId: null,
                updatedAt: sql`timezone('utc'::text, now())`,
              })
              .where(eq(invoices.stripeCheckoutSessionId, session.id))
          }
          return NextResponse.json({ ok: true, received: true })
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null)

        if (
          !coversInvoiceTotal(invoice, {
            amount: session.amount_total,
            currency: session.currency,
            source: session.id,
          })
        ) {
          return NextResponse.json({ ok: true, received: true })
        }

        await markInvoicePaid(invoice, paymentIntentId)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object

        // Clear the checkout session ID so a new one can be created
        if (session.id) {
          await db
            .update(invoices)
            .set({
              stripeCheckoutSessionId: null,
              updatedAt: sql`timezone('utc'::text, now())`,
            })
            .where(eq(invoices.stripeCheckoutSessionId, session.id))
        }

        break
      }

      default:
        // Return 200 for unknown events
        break
    }

    return NextResponse.json({ ok: true, received: true })
  } catch (err) {
    console.error('[stripe-webhook] Error processing event:', err)
    return NextResponse.json(
      { ok: false, error: 'Webhook processing failed.' },
      { status: 500 }
    )
  }
}
