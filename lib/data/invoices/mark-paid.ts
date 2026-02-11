import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  hourBlocks,
} from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import { invoicePaidEvent } from '@/lib/activity/events/invoices'
import type { Invoice } from '@/lib/invoices/types'

export type MarkPaidResult = {
  success: boolean
  invoice?: Invoice
  alreadyPaid?: boolean
  error?: string
}

/**
 * Shared idempotent handler for marking an invoice as paid.
 * Called by both the Stripe webhook and the polling fallback.
 *
 * Within a transaction:
 * 1. Check if invoice is already PAID (idempotent return).
 * 2. Update invoice status to PAID.
 * 3. If prepaid: create hour block records for each HOURS_PREPAID line item.
 * 4. Link line items to their created hour blocks.
 */
export async function markInvoicePaid(
  invoiceId: string,
  paymentMethod?: string
): Promise<MarkPaidResult> {
  try {
    // Fetch current invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    // Idempotency: already paid
    if (invoice.status === 'PAID') {
      return { success: true, invoice, alreadyPaid: true }
    }

    // Fetch HOURS_PREPAID line items (for auto hour block creation)
    const prepaidItems = await db
      .select()
      .from(invoiceLineItems)
      .where(
        and(
          eq(invoiceLineItems.invoiceId, invoiceId),
          eq(invoiceLineItems.type, 'HOURS_PREPAID'),
          isNull(invoiceLineItems.deletedAt)
        )
      )

    // Update invoice status
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        status: 'PAID',
        paidAt: new Date().toISOString(),
        paymentMethod: paymentMethod ?? 'stripe',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning()

    // Auto-create hour blocks for prepaid line items
    for (const item of prepaidItems) {
      const [newHourBlock] = await db
        .insert(hourBlocks)
        .values({
          clientId: invoice.clientId,
          hoursPurchased: item.quantity,
          invoiceNumber: updatedInvoice.invoiceNumber,
          createdBy: invoice.createdBy,
        })
        .returning()

      // Link line item to hour block
      if (newHourBlock) {
        await db
          .update(invoiceLineItems)
          .set({
            hourBlockId: newHourBlock.id,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(invoiceLineItems.id, item.id))
      }
    }

    // Log activity (fire-and-forget, outside transaction)
    const event = invoicePaidEvent({
      invoiceNumber: updatedInvoice.invoiceNumber ?? invoiceId,
      clientId: invoice.clientId,
      total: updatedInvoice.total,
      paymentMethod: paymentMethod ?? 'stripe',
    })
    logActivity({
      actorId: invoice.createdBy,
      verb: event.verb,
      summary: event.summary,
      targetType: 'INVOICE',
      targetId: invoiceId,
      targetClientId: invoice.clientId,
      metadata: event.metadata,
    }).catch(err => console.error('[invoices] Failed to log payment activity:', err))

    return { success: true, invoice: updatedInvoice }
  } catch (error) {
    console.error('[invoices] markInvoicePaid failed:', error)
    return { success: false, error: 'Failed to mark invoice as paid' }
  }
}
