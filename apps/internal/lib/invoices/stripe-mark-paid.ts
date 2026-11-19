import 'server-only'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { invoicePaidEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { createHourBlocksFromInvoice } from '@/lib/data/invoices'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { coversTotal } from '@/lib/invoices/stripe-checkout-payment'
import {
  notifyInvoicePaid,
  notifyUnbookedPayment,
} from '@/lib/notifications/google-chat'
import { captureServerException } from '@/lib/posthog/server'
import type { getInvoiceByStripeSession } from '@/lib/queries/invoices'

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
export function coversInvoiceTotal(
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

const PAYABLE_STATUSES: ('SENT' | 'VIEWED')[] = ['SENT', 'VIEWED']

export type WebhookInvoice = NonNullable<
  Awaited<ReturnType<typeof getInvoiceByStripeSession>>
>

/**
 * Money arrived for an invoice that can't take it (Draft, Void or archived).
 * It is never booked as a sale: the team is told to refund or reissue.
 * Voiding, reverting, archiving and editing stop open payments first, so
 * this means a race or a payment made outside the portal.
 */
async function flagUnbookedPayment(
  invoice: WebhookInvoice,
  paymentIntentId: string | null,
  reason: string
) {
  const error = new Error(
    `Stripe payment received but ${reason}; refund it or reissue the invoice`
  )
  console.error('[stripe-webhook]', error.message, {
    invoiceId: invoice.id,
    paymentIntentId,
  })
  captureServerException(error, {
    distinctId: 'stripe-webhook',
    properties: { invoiceId: invoice.id, paymentIntentId },
  })
  await notifyUnbookedPayment({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    total: invoice.total,
    clientName: invoice.client?.name,
    reason,
  }).catch(console.error)
}

function unbookableReason(invoice: {
  status: string
  deleted_at: string | null
}): string {
  return invoice.deleted_at
    ? 'the invoice is archived'
    : `the invoice is ${invoice.status.charAt(0)}${invoice.status.slice(1).toLowerCase()}`
}

/** What a payment did, for System health. */
export type PaymentResult = { outcome: 'ok' | 'unmatched'; detail: string }

export async function markInvoicePaid(
  invoice: WebhookInvoice,
  paymentIntentId: string | null
): Promise<PaymentResult> {
  // Only a live Sent or Viewed invoice can be paid.
  if (
    invoice.status !== 'PAID' &&
    (invoice.deleted_at ||
      !(PAYABLE_STATUSES as string[]).includes(invoice.status))
  ) {
    const reason = unbookableReason(invoice)
    await flagUnbookedPayment(invoice, paymentIntentId, reason)
    return unmatchedPayment(invoice, reason)
  }

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
          .where(
            and(
              eq(invoices.id, invoice.id),
              inArray(invoices.status, PAYABLE_STATUSES),
              isNull(invoices.deletedAt)
            )
          )
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

    // Tell the team in Google Chat. Awaited for the same reason as the log
    // above: Vercel freezes the function once the response goes out, so an
    // unawaited post never reaches Google. It never throws and gives up
    // after a few seconds. Only the delivery that flips the status gets
    // here, so retried webhooks don't re-notify.
    await notifyInvoicePaid({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      total: invoice.total,
      clientName: invoice.client?.name,
    }).catch(console.error)
  }

  // Lost a race with a void, revert or archive: the invoice was never
  // paid, so no hours.
  if (flipped.length === 0 && invoice.status !== 'PAID') {
    const [now] = await db
      .select({ status: invoices.status, deleted_at: invoices.deletedAt })
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    if (now?.status !== 'PAID') {
      const reason = now ? unbookableReason(now) : 'the invoice is gone'
      await flagUnbookedPayment(invoice, paymentIntentId, reason)
      return unmatchedPayment(invoice, reason)
    }
  }

  // Always attempt hour block creation — must be awaited so it completes
  // before the serverless function terminates. Safe to run on retries
  // because the insert uses ON CONFLICT DO NOTHING.
  await createHourBlocksFromInvoice(invoice.id)
  return {
    outcome: 'ok',
    // A replayed event finds the invoice already paid: not a second sale.
    detail: `${flipped.length > 0 ? 'Booked' : 'Already booked'} invoice ${invoice.invoice_number ?? invoice.id}`,
  }
}

function unmatchedPayment(
  invoice: WebhookInvoice,
  reason: string
): PaymentResult {
  return {
    outcome: 'unmatched',
    detail: `Payment for invoice ${invoice.invoice_number ?? invoice.id} not booked: ${reason}`,
  }
}
