import 'server-only'

import { and, eq, isNull, desc, sql, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import { invoices, invoiceLineItems, clients } from '@/lib/db/schema'
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceWithClient,
  InvoiceWithClientAndLineItems,
} from '@/lib/invoices/types'

// =============================================================================
// Invoice CRUD
// =============================================================================

export async function fetchInvoiceById(
  invoiceId: string
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  return row ?? null
}

export async function fetchInvoiceWithClient(
  invoiceId: string
): Promise<InvoiceWithClient | null> {
  const rows = await db
    .select({
      invoice: invoices,
      client: {
        id: clients.id,
        name: clients.name,
        billingType: clients.billingType,
        deletedAt: clients.deletedAt,
      },
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  if (rows.length === 0) return null

  return {
    ...rows[0].invoice,
    client: rows[0].client,
  }
}

export async function fetchInvoiceWithClientAndLineItems(
  invoiceId: string
): Promise<InvoiceWithClientAndLineItems | null> {
  const invoiceData = await fetchInvoiceWithClient(invoiceId)
  if (!invoiceData) return null

  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(invoiceLineItems.sortOrder)

  return { ...invoiceData, lineItems: items }
}

export async function fetchInvoiceByShareToken(
  token: string
): Promise<InvoiceWithClientAndLineItems | null> {
  const [row] = await db
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

  if (!row) return null

  // Fetch client
  const [clientRow] = await db
    .select({
      id: clients.id,
      name: clients.name,
      billingType: clients.billingType,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1)

  // Fetch line items
  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, row.id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(invoiceLineItems.sortOrder)

  return {
    ...row,
    client: clientRow ?? null,
    lineItems: items,
  }
}

export async function fetchInvoiceByStripePaymentIntentId(
  paymentIntentId: string
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.stripePaymentIntentId, paymentIntentId))
    .limit(1)

  return row ?? null
}

type InvoiceStatusValue = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED' | 'VOID'

export type InvoiceListFilters = {
  status?: InvoiceStatusValue[]
  clientId?: string
}

export async function listInvoices(
  filters?: InvoiceListFilters
): Promise<InvoiceWithClient[]> {
  const conditions = [isNull(invoices.deletedAt)]

  if (filters?.status && filters.status.length > 0) {
    conditions.push(
      inArray(invoices.status, filters.status)
    )
  }
  if (filters?.clientId) {
    conditions.push(eq(invoices.clientId, filters.clientId))
  }

  const rows = await db
    .select({
      invoice: invoices,
      client: {
        id: clients.id,
        name: clients.name,
        billingType: clients.billingType,
        deletedAt: clients.deletedAt,
      },
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))

  return rows.map(r => ({
    ...r.invoice,
    client: r.client,
  }))
}

// =============================================================================
// Invoice mutations
// =============================================================================

export async function createInvoice(
  data: Pick<
    Invoice,
    | 'clientId'
    | 'createdBy'
    | 'status'
    | 'billingPeriodStart'
    | 'billingPeriodEnd'
    | 'dueDate'
    | 'notes'
    | 'currency'
  >
): Promise<Invoice> {
  const [result] = await db.insert(invoices).values(data).returning()
  return result
}

export async function updateInvoice(
  invoiceId: string,
  data: Partial<Invoice>
): Promise<Invoice | null> {
  const [result] = await db
    .update(invoices)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .returning()

  return result ?? null
}

export async function softDeleteInvoice(
  invoiceId: string
): Promise<boolean> {
  const [result] = await db
    .update(invoices)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .returning()

  return !!result
}

// =============================================================================
// Line item mutations
// =============================================================================

export async function createLineItem(
  data: Pick<
    InvoiceLineItem,
    'invoiceId' | 'type' | 'description' | 'quantity' | 'unitPrice' | 'amount'
  > &
    Partial<Pick<InvoiceLineItem, 'hourBlockId' | 'metadata' | 'sortOrder'>>
): Promise<InvoiceLineItem> {
  const [result] = await db
    .insert(invoiceLineItems)
    .values(data)
    .returning()
  return result
}

export async function updateLineItem(
  lineItemId: string,
  data: Partial<InvoiceLineItem>
): Promise<InvoiceLineItem | null> {
  const [result] = await db
    .update(invoiceLineItems)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(invoiceLineItems.id, lineItemId),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .returning()

  return result ?? null
}

export async function softDeleteLineItem(
  lineItemId: string
): Promise<boolean> {
  const [result] = await db
    .update(invoiceLineItems)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(invoiceLineItems.id, lineItemId),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .returning()

  return !!result
}

/**
 * Recompute invoice subtotal and total from active line items.
 */
export async function recomputeInvoiceTotals(
  invoiceId: string
): Promise<Invoice | null> {
  const items = await db
    .select({ amount: invoiceLineItems.amount })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        isNull(invoiceLineItems.deletedAt)
      )
    )

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  )

  // Fetch current tax
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return null

  const tax = Number(invoice.tax)
  const total = subtotal + tax

  return updateInvoice(invoiceId, {
    subtotal: String(subtotal) as unknown as string,
    tax: String(tax) as unknown as string,
    total: String(total) as unknown as string,
  })
}

/**
 * Generate the next invoice number using the PG SEQUENCE.
 * Format: PREFIX-YYYY-NNNN
 */
export async function generateInvoiceNumber(
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear()

  // Use raw SQL to call nextval on the sequence.
  // The sequence is created via migration.
  const [result] = await db.execute(
    sql`SELECT nextval('invoice_number_seq') as next_val`
  )

  const nextVal = Number((result as Record<string, unknown>).next_val)
  return `${prefix}-${year}-${String(nextVal).padStart(4, '0')}`
}

/**
 * Check if a draft invoice already exists for a client and billing period.
 * Used for duplicate detection in monthly cron.
 */
export async function findExistingDraftForPeriod(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.clientId, clientId),
        eq(invoices.status, 'DRAFT'),
        eq(invoices.billingPeriodStart, periodStart),
        eq(invoices.billingPeriodEnd, periodEnd),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}
