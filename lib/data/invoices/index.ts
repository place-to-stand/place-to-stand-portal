import 'server-only'

import {
  fetchInvoiceById,
  updateInvoice,
  generateInvoiceNumber,
  recomputeInvoiceTotals,
  createInvoice,
  createLineItem,
  listInvoices,
  softDeleteInvoice,
  fetchInvoiceWithClientAndLineItems,
} from '@/lib/queries/invoices'
import { fetchBillingSettings } from '@/lib/queries/billing-settings'
import { TERMINAL_STATUSES } from '@/lib/invoices/constants'
import type { Invoice, InvoiceWithClientAndLineItems } from '@/lib/invoices/types'

// =============================================================================
// Invoice creation
// =============================================================================

export async function createDraftInvoice(params: {
  clientId: string
  createdBy: string
  billingPeriodStart?: string | null
  billingPeriodEnd?: string | null
  dueDate?: string | null
  notes?: string | null
}): Promise<Invoice> {
  const settings = await fetchBillingSettings()
  const termsDays = settings?.defaultPaymentTermsDays ?? 30

  // Calculate due date from terms if not provided
  let dueDate = params.dueDate ?? null
  if (!dueDate) {
    const due = new Date()
    due.setDate(due.getDate() + termsDays)
    dueDate = due.toISOString().split('T')[0]
  }

  return createInvoice({
    clientId: params.clientId,
    createdBy: params.createdBy,
    status: 'DRAFT',
    billingPeriodStart: params.billingPeriodStart ?? null,
    billingPeriodEnd: params.billingPeriodEnd ?? null,
    dueDate,
    notes: params.notes ?? null,
    currency: 'USD',
  })
}

// =============================================================================
// Invoice status transitions
// =============================================================================

/**
 * Send a draft invoice: assigns invoice number, transitions to SENT.
 */
export async function sendInvoice(invoiceId: string): Promise<Invoice | null> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice || invoice.status !== 'DRAFT') return null

  const settings = await fetchBillingSettings()
  const prefix = settings?.invoiceNumberPrefix ?? 'INV'
  const invoiceNumber = await generateInvoiceNumber(prefix)

  return updateInvoice(invoiceId, {
    status: 'SENT',
    invoiceNumber,
    sentAt: new Date().toISOString(),
  })
}

/**
 * Mark an invoice as viewed (only from SENT status).
 */
export async function markInvoiceViewed(
  invoiceId: string
): Promise<Invoice | null> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return null

  // Guard: only transition from SENT to VIEWED
  if (invoice.status !== 'SENT') return invoice

  return updateInvoice(invoiceId, { status: 'VIEWED' })
}

/**
 * Void an invoice (cancel it).
 */
export async function voidInvoice(invoiceId: string): Promise<Invoice | null> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return null

  // Cannot void terminal statuses other than VOID itself
  if (invoice.status === 'PAID' || invoice.status === 'REFUNDED') return null

  return updateInvoice(invoiceId, { status: 'VOID' })
}

// =============================================================================
// Immutability enforcement
// =============================================================================

/**
 * Check if an invoice can be edited (line items, totals, client).
 */
export function isInvoiceMutable(invoice: Invoice): boolean {
  return !TERMINAL_STATUSES.includes(
    invoice.status as (typeof TERMINAL_STATUSES)[number]
  )
}

// =============================================================================
// Duplicate invoice
// =============================================================================

/**
 * Duplicate an existing invoice as a new DRAFT.
 * Copies line items (excluding soft-deleted), clears hour_block_id references.
 */
export async function duplicateInvoice(
  invoiceId: string,
  createdBy: string
): Promise<InvoiceWithClientAndLineItems | null> {
  const source = await fetchInvoiceWithClientAndLineItems(invoiceId)
  if (!source) return null

  // Create new draft
  const newInvoice = await createDraftInvoice({
    clientId: source.clientId,
    createdBy,
    notes: source.notes,
  })

  // Copy active line items (clear hour_block_id)
  for (const item of source.lineItems) {
    await createLineItem({
      invoiceId: newInvoice.id,
      type: item.type,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      sortOrder: item.sortOrder,
    })
  }

  // Recompute totals
  await recomputeInvoiceTotals(newInvoice.id)

  return fetchInvoiceWithClientAndLineItems(newInvoice.id)
}

export {
  listInvoices,
  softDeleteInvoice,
  fetchInvoiceById,
  fetchInvoiceWithClientAndLineItems,
  recomputeInvoiceTotals,
}
