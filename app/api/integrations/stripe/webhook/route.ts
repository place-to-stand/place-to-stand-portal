import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { verifyWebhookSignature } from '@/lib/integrations/stripe/webhooks'
import { markInvoicePaid } from '@/lib/data/invoices/mark-paid'

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: 'Missing stripe-signature header.' },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    // Must read raw body as text for signature verification
    const rawBody = await request.text()
    event = await verifyWebhookSignature(rawBody, signature)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Invalid signature.' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        await markInvoicePaid(pi.id, pi.payment_method_types?.[0])
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        console.warn(
          '[stripe-webhook] Payment failed for PI:',
          pi.id,
          pi.last_payment_error?.message
        )
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        // Only handle full refunds
        if (charge.amount_refunded === charge.amount) {
          const piId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id
          if (piId) {
            const { updateInvoice, fetchInvoiceByStripePaymentIntentId } =
              await import('@/lib/queries/invoices')
            const { logActivity } = await import('@/lib/activity/logger')
            const { invoiceRefundedEvent } = await import(
              '@/lib/activity/events/invoices'
            )

            const invoice = await fetchInvoiceByStripePaymentIntentId(piId)
            if (invoice && invoice.status !== 'REFUNDED') {
              await updateInvoice(invoice.id, {
                status: 'REFUNDED',
                shareEnabled: false,
              })

              // Fetch client name for event
              const { db } = await import('@/lib/db')
              const { clients } = await import('@/lib/db/schema')
              const { eq } = await import('drizzle-orm')
              const clientRows = await db
                .select({ name: clients.name })
                .from(clients)
                .where(eq(clients.id, invoice.clientId))
                .limit(1)

              const ev = invoiceRefundedEvent({
                invoiceNumber: invoice.invoiceNumber,
                clientName: clientRows[0]?.name ?? 'Unknown',
                total: invoice.total,
              })
              logActivity({
                actorId: invoice.createdBy,
                verb: ev.verb,
                summary: ev.summary,
                targetType: 'INVOICE',
                targetId: invoice.id,
                metadata: ev.metadata,
              }).catch(err =>
                console.error('[stripe-webhook] Failed to log refund:', err)
              )
            }
          }
        }
        break
      }

      default:
        // Acknowledge unhandled event types
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] Error processing event:', event.type, err)
    // Return 200 to prevent Stripe from retrying — errors are logged
    return NextResponse.json({ ok: true, received: true })
  }

  return NextResponse.json({ ok: true, received: true })
}
