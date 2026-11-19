// permission: public — verified by Stripe signature
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { serverEnv } from '@/lib/env.server'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import {
  getInvoiceByStripeSession,
  getInvoiceByPaymentIntent,
} from '@/lib/queries/invoices'
import { recordSystemRun, type SystemRunOutcome } from '@/lib/health/runs'
import { checkoutPaymentOutcome } from '@/lib/invoices/stripe-checkout-payment'
import {
  coversInvoiceTotal,
  markInvoicePaid,
} from '@/lib/invoices/stripe-mark-paid'

export async function POST(request: Request) {
  const webhookSecret = serverEnv.STRIPE_WEBHOOK_SECRET

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

  const started = Date.now()
  let result: { outcome: SystemRunOutcome; detail: string | null } = {
    outcome: 'ok',
    detail: null,
  }
  const unmatched = (detail: string) => {
    result = { outcome: 'unmatched', detail }
  }

  try {
    switch (event.type) {
      // PaymentIntent flow (Payment Element)
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object

        // The intent id stored on the invoice, or the invoice id in the
        // intent's metadata when a later checkout replaced the stored id.
        const invoice = await getInvoiceByPaymentIntent(
          paymentIntent.id,
          paymentIntent.metadata?.invoiceId
        )

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for payment_intent:',
            paymentIntent.id
          )
          // Embedded checkout sends this before checkout.session.completed,
          // with no invoice in its metadata; the checkout event books it.
          if (paymentIntent.metadata?.invoiceId) {
            unmatched(`No invoice for payment ${paymentIntent.id}`)
          } else {
            result = {
              outcome: 'ok',
              detail: `Payment ${paymentIntent.id} names no invoice; its checkout books it, or it isn't from the portal`,
            }
          }
          return NextResponse.json({ ok: true, received: true })
        }

        if (
          !coversInvoiceTotal(invoice, {
            amount: paymentIntent.amount_received,
            currency: paymentIntent.currency,
            source: paymentIntent.id,
          })
        ) {
          unmatched(
            `Payment ${paymentIntent.id} doesn't cover invoice ${invoice.invoice_number ?? invoice.id}`
          )
          return NextResponse.json({ ok: true, received: true })
        }

        result = await markInvoicePaid(invoice, paymentIntent.id)
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
          unmatched(`Checkout ${session.id} names no invoice`)
          return NextResponse.json({ ok: true, received: true })
        }

        const invoice = await getInvoiceByStripeSession(session.id)

        if (!invoice) {
          console.error(
            '[stripe-webhook] Invoice not found for session:',
            session.id
          )
          unmatched(`No invoice for checkout ${session.id}`)
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
          result = {
            outcome: 'ok',
            detail: `Client's delayed payment failed for invoice ${invoice.invoice_number ?? invoice.id}; it stays unpaid`,
          }
          // Let the client start a new checkout; the invoice stays unpaid.
          if (invoice.status !== 'PAID') {
            await db
              .update(invoices)
              .set({
                // Bookkeeping, not an edit: the version stays.
                stripeCheckoutSessionId: null,
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
          unmatched(
            `Checkout ${session.id} doesn't cover invoice ${invoice.invoice_number ?? invoice.id}`
          )
          return NextResponse.json({ ok: true, received: true })
        }

        result = await markInvoicePaid(invoice, paymentIntentId)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object

        // Clear the checkout session ID so a new one can be created
        if (session.id) {
          await db
            .update(invoices)
            .set({
              // Bookkeeping, not an edit: the version stays.
              stripeCheckoutSessionId: null,
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
    result = {
      outcome: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    }
    return NextResponse.json(
      { ok: false, error: 'Webhook processing failed.' },
      { status: 500 }
    )
  } finally {
    // Awaited: Vercel stops the function once the response goes out.
    await recordSystemRun({
      kind: 'stripe',
      name: event.type,
      outcome: result.outcome,
      detail: result.detail,
      ref: event.id,
      durationMs: Date.now() - started,
    })
  }
}
