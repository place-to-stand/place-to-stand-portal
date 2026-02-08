import 'server-only'

import { cache } from 'react'

import { db } from '@/lib/db'
import {
  fetchAllInvoices,
  fetchInvoiceById,
  createInvoice as createInvoiceQuery,
  createLineItems,
  updateInvoice,
  recomputeInvoiceTotals,
  softDeleteInvoice,
} from '@/lib/queries/invoices'
import { generateShareToken } from '@/lib/sharing/tokens'
import { generateInvoiceNumber } from '@/lib/invoices/number-generator'
import { fetchBillingSettings } from '@/lib/queries/billing-settings'
import { isTerminal } from '@/lib/invoices/constants'
import { logActivity } from '@/lib/activity/logger'
import {
  invoiceCreatedEvent,
  invoiceSentEvent,
  invoiceVoidedEvent,
} from '@/lib/activity/events/invoices'
import type { InvoiceStatusValue, InvoiceWithRelations } from '@/lib/invoices/types'

// =============================================================================
// Dashboard data
// =============================================================================

export const fetchInvoicesForDashboard = cache(
  async (statusFilter?: InvoiceStatusValue[]) => {
    return fetchAllInvoices(
      statusFilter?.length ? { statusFilter } : undefined
    )
  }
)

// =============================================================================
// Create draft invoice
// =============================================================================

type CreateDraftInvoiceInput = {
  clientId: string
  createdBy: string
  dueDate?: string | null
  billingPeriodStart?: string | null
  billingPeriodEnd?: string | null
  notes?: string | null
  internalNotes?: string | null
  lineItems?: Array<{
    type: 'HOURS_PREPAID' | 'HOURS_WORKED' | 'CUSTOM'
    description: string
    quantity: string
    unitPrice: string
    amount: string
  }>
}

export async function createDraftInvoice(
  input: CreateDraftInvoiceInput,
  actorId: string
): Promise<InvoiceWithRelations | null> {
  const invoice = await createInvoiceQuery({
    clientId: input.clientId,
    createdBy: input.createdBy,
    dueDate: input.dueDate,
    billingPeriodStart: input.billingPeriodStart,
    billingPeriodEnd: input.billingPeriodEnd,
    notes: input.notes,
    internalNotes: input.internalNotes,
  })

  if (input.lineItems?.length) {
    await createLineItems(
      input.lineItems.map((li, idx) => ({
        invoiceId: invoice.id,
        type: li.type,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        sortOrder: idx,
      }))
    )
    await recomputeInvoiceTotals(invoice.id)
  }

  // Log activity (fire-and-forget)
  const event = invoiceCreatedEvent({ clientId: input.clientId })
  logActivity({
    actorId,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoice.id,
    metadata: event.metadata,
  }).catch(err => console.error('[invoices] Failed to log creation:', err))

  return fetchInvoiceById(invoice.id)
}

// =============================================================================
// Send invoice
// =============================================================================

export async function sendInvoice(
  invoiceId: string,
  actorId: string
): Promise<InvoiceWithRelations | null> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return null
  if (invoice.status !== 'DRAFT') return null

  const settings = await fetchBillingSettings()
  const prefix = settings?.invoicePrefix ?? 'PTS'
  const invoiceNumber = await generateInvoiceNumber(db, prefix)
  const shareToken = generateShareToken()

  await updateInvoice(invoiceId, {
    status: 'SENT',
    invoiceNumber,
    shareToken,
    shareEnabled: true,
    issuedAt: new Date().toISOString(),
  })

  // Log activity (fire-and-forget)
  const event = invoiceSentEvent({
    invoiceNumber,
    clientName: invoice.client.name,
    total: invoice.total,
  })
  logActivity({
    actorId,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoiceId,
    metadata: event.metadata,
  }).catch(err => console.error('[invoices] Failed to log send:', err))

  return fetchInvoiceById(invoiceId)
}

// =============================================================================
// Void invoice
// =============================================================================

export async function voidInvoice(
  invoiceId: string,
  actorId: string
): Promise<boolean> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return false
  if (isTerminal(invoice.status)) return false

  await updateInvoice(invoiceId, {
    status: 'VOID',
    shareEnabled: false,
  })

  const event = invoiceVoidedEvent({
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
  })
  logActivity({
    actorId,
    verb: event.verb,
    summary: event.summary,
    targetType: 'INVOICE',
    targetId: invoiceId,
    metadata: event.metadata,
  }).catch(err => console.error('[invoices] Failed to log void:', err))

  return true
}

// =============================================================================
// Duplicate invoice
// =============================================================================

export async function duplicateInvoice(
  invoiceId: string,
  actorId: string
): Promise<InvoiceWithRelations | null> {
  const original = await fetchInvoiceById(invoiceId)
  if (!original) return null

  return createDraftInvoice(
    {
      clientId: original.clientId,
      createdBy: actorId,
      dueDate: null,
      notes: original.notes,
      internalNotes: original.internalNotes,
      lineItems: original.lineItems.map(li => ({
        type: li.type,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
      })),
    },
    actorId
  )
}

// =============================================================================
// Delete draft
// =============================================================================

export async function deleteDraftInvoice(
  invoiceId: string
): Promise<boolean> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return false
  if (invoice.status !== 'DRAFT') return false

  return softDeleteInvoice(invoiceId)
}
