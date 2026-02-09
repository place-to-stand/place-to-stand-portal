import { NextResponse } from 'next/server'

import {
  verifyWebhookSignature,
  extractPaymentIntentId,
} from '@/lib/integrations/stripe/webhooks'
import { markInvoicePaid } from '@/lib/data/invoices/mark-paid'
import { fetchInvoiceByStripePaymentIntentId } from '@/lib/queries/invoices'
import { updateInvoice } from '@/lib/queries/invoices'
import { logActivity } from '@/lib/activity/logger'
import { invoiceRefundedEvent } from '@/lib/activity/events/invoices'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify signature
    const event = verifyWebhookSignature(body, signature)

    // Extract payment intent ID
    const paymentIntentId = extractPaymentIntentId(event)
    if (!paymentIntentId) {
      // Unknown event type — acknowledge per Stripe best practice
      return NextResponse.json({ received: true })
    }

    // Look up invoice
    const invoice = await fetchInvoiceByStripePaymentIntentId(paymentIntentId)
    if (!invoice) {
      // No matching invoice — acknowledge (Stripe recommends 200 for unknown events)
      return NextResponse.json({ received: true })
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const result = await markInvoicePaid(invoice.id, 'stripe_card')
        if (!result.success && !result.alreadyPaid) {
          console.error(
            '[stripe-webhook] Failed to mark invoice paid:',
            result.error
          )
        }
        break
      }

      case 'payment_intent.payment_failed': {
        console.warn(
          `[stripe-webhook] Payment failed for invoice ${invoice.id}`
        )
        // No status change — client can retry
        break
      }

      case 'charge.refunded': {
        if (invoice.status !== 'REFUNDED') {
          await updateInvoice(invoice.id, { status: 'REFUNDED' })

          // Log activity
          const activityEvent = invoiceRefundedEvent({
            invoiceNumber: invoice.invoiceNumber ?? invoice.id,
            clientId: invoice.clientId,
          })
          logActivity({
            actorId: invoice.createdBy,
            verb: activityEvent.verb,
            summary: activityEvent.summary,
            targetType: 'INVOICE',
            targetId: invoice.id,
            targetClientId: invoice.clientId,
            metadata: activityEvent.metadata,
          }).catch(err =>
            console.error('[stripe-webhook] Failed to log refund activity:', err)
          )
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe-webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    )
  }
}
