'use server'

import crypto from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceSentEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import {
  invoices,
  invoiceLineItems,
  clients,
  contacts,
  contactClients,
} from '@/lib/db/schema'
import { serverEnv } from '@/lib/env.server'
import { generateInvoicePdf } from '@/lib/invoices/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/email/send-invoice-email'
import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'

import { sendSchema } from './schemas'
import type { SendResult, SendInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function sendInvoiceAction(
  input: SendInput,
): Promise<SendResult> {
  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode: 'send',
      targetId: input.id,
    },
    async () => performSendInvoice(input),
  )
}

async function performSendInvoice(
  input: SendInput,
): Promise<SendResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = sendSchema.safeParse(input)

  if (!parsed.success) {
    return { error: 'Invalid send request.' }
  }

  const invoiceId = parsed.data.id

  const existingRows = await db
    .select({
      id: invoices.id,
      status: invoices.status,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  const existing = existingRows[0]

  if (!existing) {
    return { error: 'Invoice not found.' }
  }

  if (existing.status !== 'DRAFT') {
    return { error: 'Only draft invoices can be sent.' }
  }

  const invoiceNumber = existing.invoiceNumber

  if (!invoiceNumber) {
    return { error: 'Invoice is missing an invoice number.' }
  }

  const clientRows = await db
    .select({ name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, existing.clientId), isNull(clients.deletedAt)))
    .limit(1)

  const clientName = clientRows[0]?.name ?? null

  try {
    const today = new Date().toISOString().split('T')[0]!
    const shareToken = crypto.randomUUID().replace(/-/g, '')
    const nowIso = new Date().toISOString()

    await db
      .update(invoices)
      .set({
        status: 'SENT',
        issuedDate: today,
        shareToken,
        shareEnabled: true,
        updatedAt: nowIso,
      })
      .where(eq(invoices.id, invoiceId))

    const event = invoiceSentEvent({
      invoiceNumber,
      clientName,
      total: existing.total,
    })

    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      verb: event.verb,
      summary: event.summary,
      targetType: 'INVOICE',
      targetId: invoiceId,
      targetClientId: existing.clientId,
      metadata: event.metadata,
    })

    // EMAIL SENDING DISABLED — will revisit in a future iteration.
    // deliverInvoiceEmail({
    //   invoiceId,
    //   invoiceNumber,
    //   clientId: existing.clientId,
    //   clientName: clientName ?? 'Client',
    //   total: existing.total,
    //   dueDate: null,
    //   shareToken,
    // }).catch(error => {
    //   console.error('Failed to deliver invoice email', error)
    // })

    revalidatePath(INVOICES_PATH)

    return { invoiceNumber }
  } catch (error) {
    console.error('Failed to send invoice', error)

    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unable to send invoice.',
    }
  }
}

// ---------------------------------------------------------------------------
// Email delivery (fire-and-forget)
// ---------------------------------------------------------------------------

const formatCurrency = (amount: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount))

const formatDate = (date: string | null): string | null => {
  if (!date) return null
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function deliverInvoiceEmail(params: {
  invoiceId: string
  invoiceNumber: string
  clientId: string
  clientName: string
  total: string
  dueDate: string | null
  shareToken: string
}) {
  // 1. Fetch full invoice with line items for PDF
  const invoiceRows = await db
    .select({
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
      billingType: invoices.billingType,
      viewedAt: invoices.viewedAt,
      viewedCount: invoices.viewedCount,
      stripeCheckoutSessionId: invoices.stripeCheckoutSessionId,
      stripePaymentIntentId: invoices.stripePaymentIntentId,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      deletedAt: invoices.deletedAt,
    })
    .from(invoices)
    .where(eq(invoices.id, params.invoiceId))
    .limit(1)

  const inv = invoiceRows[0]
  if (!inv) return

  const lineItemRows = await db
    .select({
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
    })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, params.invoiceId),
        isNull(invoiceLineItems.deletedAt),
      ),
    )

  const fullInvoice: InvoiceWithLineItems = {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    status: inv.status,
    client_id: inv.clientId,
    created_by: inv.createdBy,
    proposal_id: inv.proposalId,
    issued_date: inv.issuedDate,
    due_date: inv.dueDate,
    subtotal: inv.subtotal,
    tax_rate: inv.taxRate,
    tax_amount: inv.taxAmount,
    total: inv.total,
    notes: inv.notes,
    share_token: inv.shareToken,
    share_enabled: inv.shareEnabled,
    billing_type: inv.billingType,
    viewed_at: inv.viewedAt,
    viewed_count: inv.viewedCount,
    stripe_checkout_session_id: inv.stripeCheckoutSessionId,
    stripe_payment_intent_id: inv.stripePaymentIntentId,
    paid_at: inv.paidAt,
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
    deleted_at: inv.deletedAt,
    client: { id: params.clientId, name: params.clientName, slug: null, deleted_at: null },
    line_items: lineItemRows.map(li => ({
      id: li.id,
      invoice_id: li.invoiceId,
      product_catalog_item_id: li.productCatalogItemId,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unitPrice,
      amount: li.amount,
      sort_order: li.sortOrder,
      creates_hour_block: li.createsHourBlock,
      created_at: li.createdAt,
      updated_at: li.updatedAt,
      deleted_at: li.deletedAt,
    })),
  }

  const baseUrl =
    serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const shareUrl = `${baseUrl}/share/invoices/${params.shareToken}`

  // 2. Generate PDF
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateInvoicePdf(fullInvoice, shareUrl)
  } catch (error) {
    console.error('Failed to generate invoice PDF', error)
  }

  // 3. Fetch client contacts
  const contactRows = await db
    .select({ email: contacts.email })
    .from(contactClients)
    .innerJoin(contacts, eq(contactClients.contactId, contacts.id))
    .where(
      and(
        eq(contactClients.clientId, params.clientId),
        isNull(contacts.deletedAt),
      ),
    )

  const recipientEmails = contactRows
    .map(r => r.email)
    .filter(Boolean)

  if (recipientEmails.length === 0) {
    console.warn(
      `No contacts found for client ${params.clientId}. Skipping invoice email.`,
    )
    return
  }

  // 4. Send email
  await sendInvoiceEmail({
    to: recipientEmails,
    invoiceNumber: params.invoiceNumber,
    formattedTotal: formatCurrency(params.total),
    formattedDueDate: formatDate(fullInvoice.due_date),
    clientName: params.clientName,
    shareUrl,
    pdfBuffer,
  })
}
