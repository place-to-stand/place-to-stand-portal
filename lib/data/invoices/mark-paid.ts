import 'server-only'

import { sql, eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  hourBlocks,
} from '@/lib/db/schema'
import { fetchInvoiceByStripePaymentIntentId } from '@/lib/queries/invoices'
import { logActivity } from '@/lib/activity/logger'
import { invoicePaidEvent } from '@/lib/activity/events/invoices'

/**
 * Mark an invoice as paid (called from Stripe webhook or manual polling).
 * Idempotent: if already PAID, returns early.
 * Transactional: updates invoice status + creates hour blocks atomically.
 */
export async function markInvoicePaid(
  stripePaymentIntentId: string,
  paymentMethod?: string
): Promise<boolean> {
  const invoice = await fetchInvoiceByStripePaymentIntentId(stripePaymentIntentId)
  if (!invoice) {
    console.warn('[markInvoicePaid] No invoice found for PI:', stripePaymentIntentId)
    return false
  }

  // Idempotency: already paid
  if (invoice.status === 'PAID') {
    return true
  }

  await db.transaction(async (tx) => {
    // Update invoice status
    await tx
      .update(invoices)
      .set({
        status: 'PAID',
        paidAt: new Date().toISOString(),
        amountPaid: invoice.total,
        paymentMethod: paymentMethod ?? 'stripe',
        updatedAt: sql`timezone('utc'::text, now())`,
      })
      .where(eq(invoices.id, invoice.id))

    // For each HOURS_PREPAID line item, create an hour block
    const prepaidItems = await tx
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoice.id),
          eq(invoiceLineItems.type, 'HOURS_PREPAID'),
          isNull(invoiceLineItems.deletedAt)
        )
      )

    for (const item of prepaidItems) {
      const [block] = await tx
        .insert(hourBlocks)
        .values({
          clientId: invoice.clientId,
          hoursPurchased: item.quantity,
          invoiceNumber: invoice.invoiceNumber,
          createdBy: invoice.createdBy,
        })
        .returning()

      // Link the line item to the new hour block
      await tx
        .update(invoiceLineItems)
        .set({
          hourBlockId: block.id,
          updatedAt: sql`timezone('utc'::text, now())`,
        })
        .where(eq(invoiceLineItems.id, item.id))
    }
  })

  // Log activity outside transaction (fire-and-forget)
  // Fetch client name for the event summary
  const { clients } = await import('@/lib/db/schema')
  const clientRows = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .limit(1)

  const event = invoicePaidEvent({
    invoiceNumber: invoice.invoiceNumber,
    clientName: clientRows[0]?.name ?? 'Unknown',
    total: invoice.total,
  })
  logActivity({
    actorId: invoice.createdBy,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoice.id,
    metadata: event.metadata,
  }).catch(err => console.error('[invoices] Failed to log payment:', err))

  return true
}
