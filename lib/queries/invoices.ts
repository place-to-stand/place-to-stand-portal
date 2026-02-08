import 'server-only'

import { and, desc, eq, isNull, sql, inArray } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  clients,
  users,
} from '@/lib/db/schema'
import type { Invoice, InvoiceLine, InvoiceWithRelations, InvoiceStatusValue } from '@/lib/invoices/types'

// =============================================================================
// Invoice CRUD
// =============================================================================

export async function fetchInvoiceById(
  id: string
): Promise<InvoiceWithRelations | null> {
  const rows = await db
    .select({
      invoice: invoices,
      client: {
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        billingType: clients.billingType,
      },
      createdByUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(users, eq(invoices.createdBy, users.id))
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .limit(1)

  if (!rows[0]) return null

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(invoiceLineItems.sortOrder)

  return {
    ...rows[0].invoice,
    client: rows[0].client!,
    createdByUser: rows[0].createdByUser,
    lineItems: lineItemRows,
  }
}

export async function fetchInvoiceByShareToken(
  token: string
): Promise<InvoiceWithRelations | null> {
  const rows = await db
    .select({
      invoice: invoices,
      client: {
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        billingType: clients.billingType,
      },
      createdByUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(users, eq(invoices.createdBy, users.id))
    .where(
      and(
        eq(invoices.shareToken, token),
        eq(invoices.shareEnabled, true),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1)

  if (!rows[0]) return null

  const lineItemRows = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, rows[0].invoice.id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(invoiceLineItems.sortOrder)

  return {
    ...rows[0].invoice,
    client: rows[0].client!,
    createdByUser: rows[0].createdByUser,
    lineItems: lineItemRows,
  }
}

export async function fetchInvoiceByStripePaymentIntentId(
  piId: string
): Promise<Invoice | null> {
  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.stripePaymentIntentId, piId),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

type FetchAllInvoicesOptions = {
  statusFilter?: InvoiceStatusValue[]
  clientId?: string
}

export async function fetchAllInvoices(
  options?: FetchAllInvoicesOptions
): Promise<InvoiceWithRelations[]> {
  const conditions = [isNull(invoices.deletedAt)]

  if (options?.statusFilter?.length) {
    conditions.push(inArray(invoices.status, options.statusFilter))
  }
  if (options?.clientId) {
    conditions.push(eq(invoices.clientId, options.clientId))
  }

  const rows = await db
    .select({
      invoice: invoices,
      client: {
        id: clients.id,
        name: clients.name,
        slug: clients.slug,
        billingType: clients.billingType,
      },
      createdByUser: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      },
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(users, eq(invoices.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))

  if (rows.length === 0) return []

  // Batch load all line items
  const invoiceIds = rows.map(r => r.invoice.id)
  const allLineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(
      and(
        inArray(invoiceLineItems.invoiceId, invoiceIds),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(invoiceLineItems.sortOrder)

  const lineItemsByInvoice = new Map<string, InvoiceLine[]>()
  for (const li of allLineItems) {
    const arr = lineItemsByInvoice.get(li.invoiceId) ?? []
    arr.push(li)
    lineItemsByInvoice.set(li.invoiceId, arr)
  }

  return rows.map(r => ({
    ...r.invoice,
    client: r.client!,
    createdByUser: r.createdByUser,
    lineItems: lineItemsByInvoice.get(r.invoice.id) ?? [],
  }))
}

// =============================================================================
// Mutations
// =============================================================================

type CreateInvoiceInput = {
  clientId: string
  createdBy: string
  dueDate?: string | null
  billingPeriodStart?: string | null
  billingPeriodEnd?: string | null
  notes?: string | null
  internalNotes?: string | null
}

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<Invoice> {
  const [invoice] = await db
    .insert(invoices)
    .values({
      clientId: input.clientId,
      createdBy: input.createdBy,
      dueDate: input.dueDate ?? null,
      billingPeriodStart: input.billingPeriodStart ?? null,
      billingPeriodEnd: input.billingPeriodEnd ?? null,
      notes: input.notes ?? null,
      internalNotes: input.internalNotes ?? null,
    })
    .returning()

  return invoice
}

type UpdateInvoiceInput = Partial<{
  status: InvoiceStatusValue
  invoiceNumber: string
  dueDate: string | null
  billingPeriodStart: string | null
  billingPeriodEnd: string | null
  subtotal: string
  taxRate: string
  taxAmount: string
  total: string
  amountPaid: string
  issuedAt: string | null
  paidAt: string | null
  shareToken: string | null
  shareEnabled: boolean
  stripePaymentIntentId: string | null
  paymentMethod: string | null
  notes: string | null
  internalNotes: string | null
  viewedAt: string | null
  viewedCount: number
}>

export async function updateInvoice(
  id: string,
  data: UpdateInvoiceInput
): Promise<Invoice | null> {
  const rows = await db
    .update(invoices)
    .set({
      ...data,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .returning()

  return rows[0] ?? null
}

export async function softDeleteInvoice(id: string): Promise<boolean> {
  const rows = await db
    .update(invoices)
    .set({
      deletedAt: sql`timezone('utc'::text, now())`,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
    .returning({ id: invoices.id })

  return rows.length > 0
}

// =============================================================================
// Line Items
// =============================================================================

type CreateLineItemInput = {
  invoiceId: string
  type: InvoiceLine['type']
  description: string
  quantity: string
  unitPrice: string
  amount: string
  hourBlockId?: string | null
  sortOrder?: number
}

export async function createLineItem(
  input: CreateLineItemInput
): Promise<InvoiceLine> {
  const [item] = await db
    .insert(invoiceLineItems)
    .values({
      invoiceId: input.invoiceId,
      type: input.type,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      hourBlockId: input.hourBlockId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()

  return item
}

export async function createLineItems(
  items: CreateLineItemInput[]
): Promise<InvoiceLine[]> {
  if (items.length === 0) return []

  return db
    .insert(invoiceLineItems)
    .values(
      items.map(input => ({
        invoiceId: input.invoiceId,
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        amount: input.amount,
        hourBlockId: input.hourBlockId ?? null,
        sortOrder: input.sortOrder ?? 0,
      }))
    )
    .returning()
}

export async function updateLineItem(
  id: string,
  data: Partial<{
    description: string
    quantity: string
    unitPrice: string
    amount: string
    type: InvoiceLine['type']
    sortOrder: number
    hourBlockId: string | null
  }>
): Promise<InvoiceLine | null> {
  const rows = await db
    .update(invoiceLineItems)
    .set({
      ...data,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(and(eq(invoiceLineItems.id, id), isNull(invoiceLineItems.deletedAt)))
    .returning()

  return rows[0] ?? null
}

export async function softDeleteLineItem(id: string): Promise<boolean> {
  const rows = await db
    .update(invoiceLineItems)
    .set({
      deletedAt: sql`timezone('utc'::text, now())`,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(and(eq(invoiceLineItems.id, id), isNull(invoiceLineItems.deletedAt)))
    .returning({ id: invoiceLineItems.id })

  return rows.length > 0
}

// =============================================================================
// Totals
// =============================================================================

/**
 * Recompute invoice subtotal/total from non-deleted line items and persist.
 */
export async function recomputeInvoiceTotals(
  invoiceId: string
): Promise<Invoice | null> {
  const lineItemRows = await db
    .select({ amount: invoiceLineItems.amount })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        isNull(invoiceLineItems.deletedAt)
      )
    )

  const subtotal = lineItemRows.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  )

  // Read current tax rate
  const [invoice] = await db
    .select({ taxRate: invoices.taxRate })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!invoice) return null

  const taxRate = Number(invoice.taxRate)
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  return updateInvoice(invoiceId, {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  })
}

// =============================================================================
// View tracking
// =============================================================================

/**
 * Record a view on an invoice. Only transitions SENT→VIEWED on first view.
 */
export async function recordInvoiceView(
  invoiceId: string,
  currentStatus: InvoiceStatusValue
): Promise<void> {
  const updates: UpdateInvoiceInput = {
    viewedCount: sql`COALESCE(viewed_count, 0) + 1` as unknown as number,
  }

  // Only set viewedAt and transition status on first view
  if (currentStatus === 'SENT') {
    updates.viewedAt = new Date().toISOString()
    updates.status = 'VIEWED'
  }

  await db
    .update(invoices)
    .set({
      ...updates,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(eq(invoices.id, invoiceId))
}
