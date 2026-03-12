import 'server-only'

import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients, invoices, invoiceLineItems } from '@/lib/db/schema'

import type {
  ClientRow,
  InvoiceLineItemRow,
  InvoiceWithClient,
  InvoiceWithLineItems,
} from '@/lib/invoices/invoice-form'

import {
  listProductCatalogItems,
  type ProductCatalogItemRow,
} from '@/lib/queries/product-catalog'
import {
  listTaxRates,
  type TaxRateRow,
} from '@/lib/queries/tax-rates'

// ---------------------------------------------------------------------------
// Selection objects
// ---------------------------------------------------------------------------

const invoiceSelection = {
  id: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  status: invoices.status,
  clientId: invoices.clientId,
  createdBy: invoices.createdBy,
  proposalId: invoices.proposalId,
  issuedDate: invoices.issuedDate,
  dueDate: invoices.dueDate,
  subtotal: invoices.subtotal,
  taxRate: invoices.taxRate,
  taxAmount: invoices.taxAmount,
  total: invoices.total,
  notes: invoices.notes,
  shareToken: invoices.shareToken,
  shareEnabled: invoices.shareEnabled,
  viewedAt: invoices.viewedAt,
  viewedCount: invoices.viewedCount,
  stripeCheckoutSessionId: invoices.stripeCheckoutSessionId,
  stripePaymentIntentId: invoices.stripePaymentIntentId,
  paidAt: invoices.paidAt,
  createdAt: invoices.createdAt,
  updatedAt: invoices.updatedAt,
  deletedAt: invoices.deletedAt,
} as const

const lineItemSelection = {
  id: invoiceLineItems.id,
  invoiceId: invoiceLineItems.invoiceId,
  productCatalogItemId: invoiceLineItems.productCatalogItemId,
  description: invoiceLineItems.description,
  quantity: invoiceLineItems.quantity,
  unitPrice: invoiceLineItems.unitPrice,
  amount: invoiceLineItems.amount,
  sortOrder: invoiceLineItems.sortOrder,
  createsHourBlock: invoiceLineItems.createsHourBlock,
  createdAt: invoiceLineItems.createdAt,
  updatedAt: invoiceLineItems.updatedAt,
  deletedAt: invoiceLineItems.deletedAt,
} as const

const clientSelection = {
  id: clients.id,
  name: clients.name,
  billingType: clients.billingType,
  state: clients.state,
  deletedAt: clients.deletedAt,
} as const

// ---------------------------------------------------------------------------
// Internal selection types (raw query shapes)
// ---------------------------------------------------------------------------

type InvoiceSelectionRow = {
  invoice: {
    id: string
    invoiceNumber: string | null
    status: string
    clientId: string
    createdBy: string | null
    proposalId: string | null
    issuedDate: string | null
    dueDate: string | null
    subtotal: string
    taxRate: string | null
    taxAmount: string
    total: string
    notes: string | null
    shareToken: string | null
    shareEnabled: boolean
    viewedAt: string | null
    viewedCount: number
    stripeCheckoutSessionId: string | null
    stripePaymentIntentId: string | null
    paidAt: string | null
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  }
  client: {
    id: string
    name: string
    billingType: string
    state: string | null
    deletedAt: string | null
  } | null
}

type LineItemSelectionRow = {
  id: string
  invoiceId: string
  productCatalogItemId: string | null
  description: string
  quantity: string
  unitPrice: string
  amount: string
  sortOrder: number
  createsHourBlock: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type ClientSelectionRow = {
  id: string
  name: string
  billingType: string
  state: string | null
  deletedAt: string | null
}

// ---------------------------------------------------------------------------
// List invoices
// ---------------------------------------------------------------------------

export type ListInvoicesInput = {
  status?: 'active' | 'archived'
  offset?: number | null
  limit?: number | null
}

export type ListInvoicesResult = {
  items: InvoiceWithClient[]
  clients: ClientRow[]
  productCatalog: ProductCatalogItemRow[]
  taxRates: TaxRateRow[]
  totalCount: number
}

export async function listInvoices(
  user: AppUser,
  input: ListInvoicesInput = {}
): Promise<ListInvoicesResult> {
  assertAdmin(user)

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const normalizedStatus = input.status === 'archived' ? 'archived' : 'active'

  const baseConditions: SQL[] = []

  if (normalizedStatus === 'active') {
    baseConditions.push(isNull(invoices.deletedAt))
  } else {
    baseConditions.push(sql`${invoices.deletedAt} IS NOT NULL`)
  }

  const baseWhere =
    baseConditions.length > 0 ? and(...baseConditions) : undefined

  const rows = (await db
    .select({
      invoice: invoiceSelection,
      client: clientSelection,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(baseWhere)
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(limit)
    .offset(offset)) as InvoiceSelectionRow[]

  const invoicesList = rows.map(mapInvoiceWithClient)

  const [totalResult, clientDirectory, productCatalog, activeTaxRates] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(baseWhere),
      db
        .select(clientSelection)
        .from(clients)
        .orderBy(asc(clients.name)) as Promise<ClientSelectionRow[]>,
      listProductCatalogItems(),
      listTaxRates(),
    ])

  const totalCount = Number(totalResult[0]?.count ?? 0)

  return {
    items: invoicesList,
    clients: clientDirectory.map(mapClientRow),
    productCatalog,
    taxRates: activeTaxRates,
    totalCount,
  }
}

// ---------------------------------------------------------------------------
// Get invoice by ID (admin)
// ---------------------------------------------------------------------------

export async function getInvoiceById(
  user: AppUser,
  id: string
): Promise<InvoiceWithLineItems | null> {
  assertAdmin(user)

  const rows = (await db
    .select({
      invoice: invoiceSelection,
      client: clientSelection,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, id))
    .limit(1)) as InvoiceSelectionRow[]

  if (!rows.length) {
    return null
  }

  const invoice = mapInvoiceWithClient(rows[0]!)

  const lineItemRows = (await db
    .select(lineItemSelection)
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(asc(invoiceLineItems.sortOrder))) as LineItemSelectionRow[]

  return {
    ...invoice,
    line_items: lineItemRows.map(mapLineItemRow),
  }
}

// ---------------------------------------------------------------------------
// Get invoice by share token (public - no auth check)
// ---------------------------------------------------------------------------

export async function getInvoiceByShareToken(
  token: string
): Promise<InvoiceWithLineItems | null> {
  const rows = (await db
    .select({
      invoice: invoiceSelection,
      client: clientSelection,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.shareToken, token),
        eq(invoices.shareEnabled, true),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1)) as InvoiceSelectionRow[]

  if (!rows.length) {
    return null
  }

  const invoice = mapInvoiceWithClient(rows[0]!)

  const lineItemRows = (await db
    .select(lineItemSelection)
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoice.id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(asc(invoiceLineItems.sortOrder))) as LineItemSelectionRow[]

  return {
    ...invoice,
    line_items: lineItemRows.map(mapLineItemRow),
  }
}

// ---------------------------------------------------------------------------
// Get invoice by Stripe checkout session (webhook - no auth, no deletedAt filter)
// ---------------------------------------------------------------------------

export async function getInvoiceByStripeSession(
  sessionId: string
): Promise<InvoiceWithLineItems | null> {
  const rows = (await db
    .select({
      invoice: invoiceSelection,
      client: clientSelection,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.stripeCheckoutSessionId, sessionId))
    .limit(1)) as InvoiceSelectionRow[]

  if (!rows.length) {
    return null
  }

  const invoice = mapInvoiceWithClient(rows[0]!)

  const lineItemRows = (await db
    .select(lineItemSelection)
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoice.id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(asc(invoiceLineItems.sortOrder))) as LineItemSelectionRow[]

  return {
    ...invoice,
    line_items: lineItemRows.map(mapLineItemRow),
  }
}

export async function getInvoiceByPaymentIntent(
  paymentIntentId: string
): Promise<InvoiceWithLineItems | null> {
  const rows = (await db
    .select({
      invoice: invoiceSelection,
      client: clientSelection,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.stripePaymentIntentId, paymentIntentId))
    .limit(1)) as InvoiceSelectionRow[]

  if (!rows.length) {
    return null
  }

  const invoice = mapInvoiceWithClient(rows[0]!)

  const lineItemRows = (await db
    .select(lineItemSelection)
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoice.id),
        isNull(invoiceLineItems.deletedAt)
      )
    )
    .orderBy(asc(invoiceLineItems.sortOrder))) as LineItemSelectionRow[]

  return {
    ...invoice,
    line_items: lineItemRows.map(mapLineItemRow),
  }
}

// ---------------------------------------------------------------------------
// Record invoice view (atomic)
// ---------------------------------------------------------------------------

export async function recordInvoiceView(
  invoiceId: string
): Promise<number> {
  const result = await db
    .update(invoices)
    .set({
      viewedAt: sql`timezone('utc'::text, now())`,
      viewedCount: sql`${invoices.viewedCount} + 1`,
      status: sql`CASE WHEN ${invoices.status} = 'SENT' THEN 'VIEWED'::invoice_status ELSE ${invoices.status} END`,
      updatedAt: sql`timezone('utc'::text, now())`,
    })
    .where(eq(invoices.id, invoiceId))
    .returning({ previousCount: invoices.viewedCount })

  // viewedCount was already incremented in the UPDATE, so the returned value
  // is the NEW count. The previous count is newCount - 1.
  const newCount = result[0]?.previousCount ?? 0
  return newCount - 1
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapInvoiceWithClient(row: InvoiceSelectionRow): InvoiceWithClient {
  const client =
    row.client && row.client.id
      ? {
          id: row.client.id,
          name: row.client.name,
          deleted_at: row.client.deletedAt,
        }
      : null

  return {
    id: row.invoice.id,
    invoice_number: row.invoice.invoiceNumber,
    status: row.invoice.status,
    client_id: row.invoice.clientId,
    created_by: row.invoice.createdBy,
    proposal_id: row.invoice.proposalId,
    issued_date: row.invoice.issuedDate,
    due_date: row.invoice.dueDate,
    subtotal: row.invoice.subtotal,
    tax_rate: row.invoice.taxRate,
    tax_amount: row.invoice.taxAmount,
    total: row.invoice.total,
    notes: row.invoice.notes,
    share_token: row.invoice.shareToken,
    share_enabled: row.invoice.shareEnabled,
    viewed_at: row.invoice.viewedAt,
    viewed_count: row.invoice.viewedCount,
    stripe_checkout_session_id: row.invoice.stripeCheckoutSessionId,
    stripe_payment_intent_id: row.invoice.stripePaymentIntentId,
    paid_at: row.invoice.paidAt,
    created_at: row.invoice.createdAt,
    updated_at: row.invoice.updatedAt,
    deleted_at: row.invoice.deletedAt,
    client,
  }
}

function mapLineItemRow(row: LineItemSelectionRow): InvoiceLineItemRow {
  return {
    id: row.id,
    invoice_id: row.invoiceId,
    product_catalog_item_id: row.productCatalogItemId,
    description: row.description,
    quantity: row.quantity,
    unit_price: row.unitPrice,
    amount: row.amount,
    sort_order: row.sortOrder,
    creates_hour_block: row.createsHourBlock,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt,
  }
}

function mapClientRow(row: ClientSelectionRow): ClientRow {
  return {
    id: row.id,
    name: row.name,
    billing_type: row.billingType,
    state: row.state,
    deleted_at: row.deletedAt,
  }
}
