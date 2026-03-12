import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  clients,
  hourBlocks,
  invoiceLineItems,
  invoices,
} from '@/lib/db/schema'
import { hourBlockCreatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'

/**
 * Creates hour blocks for qualifying invoice line items after payment.
 * Called from the Stripe webhook handler — no auth check needed.
 *
 * Uses ON CONFLICT DO NOTHING on the unique partial index
 * (invoice_line_item_id WHERE deleted_at IS NULL) for idempotency.
 */
export async function createHourBlocksFromInvoice(
  invoiceId: string
): Promise<void> {
  // Fetch invoice with client info
  const [invoice] = await db
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      createdBy: invoices.createdBy,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) {
    console.error(
      `[createHourBlocksFromInvoice] Invoice not found: ${invoiceId}`
    )
    return
  }

  // Fetch qualifying line items
  const lineItems = await db
    .select({
      id: invoiceLineItems.id,
      quantity: invoiceLineItems.quantity,
      description: invoiceLineItems.description,
    })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.createsHourBlock, true),
        isNull(invoiceLineItems.deletedAt)
      )
    )

  // Filter out zero/negative quantities
  const qualifying = lineItems.filter(item => Number(item.quantity) > 0)

  if (!qualifying.length) {
    return
  }

  for (const item of qualifying) {
    const hoursPurchased = Number(item.quantity).toFixed(2)

    // INSERT with ON CONFLICT DO NOTHING for idempotency
    await db
      .insert(hourBlocks)
      .values({
        clientId: invoice.clientId,
        hoursPurchased,
        invoiceId: invoice.id,
        invoiceLineItemId: item.id,
        invoiceNumber: invoice.invoiceNumber,
        createdBy: invoice.createdBy,
      })
      .onConflictDoNothing({
        target: hourBlocks.invoiceLineItemId,
        where: sql`deleted_at IS NULL AND invoice_line_item_id IS NOT NULL`,
      })

    // Log activity (fire-and-forget)
    if (invoice.createdBy) {
      const event = hourBlockCreatedEvent({
        clientName: invoice.clientName,
        hoursPurchased: Number(hoursPurchased),
        invoiceNumber: invoice.invoiceNumber,
      })

      logActivity({
        actorId: invoice.createdBy,
        verb: event.verb,
        summary: event.summary,
        targetType: 'HOUR_BLOCK',
        targetClientId: invoice.clientId,
        metadata: event.metadata,
      }).catch(console.error)
    }
  }
}
