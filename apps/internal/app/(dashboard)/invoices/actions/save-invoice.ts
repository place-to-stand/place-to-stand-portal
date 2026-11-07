'use server'
import { currentBillingTypeSql } from '@pts/db/terms'
import { ensureClientCompany } from '@/lib/companies/billing/ensure-client-company'
import { isClientCompany } from '@pts/db/client-state'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity/logger'
import { invoiceCreatedEvent, invoiceUpdatedEvent } from '@/lib/activity/events'
import { trackSettingsServerInteraction } from '@/lib/posthog/server'
import { db } from '@/lib/db'
import {
  centsToAmount,
  invoiceTotals,
  lineItemCents,
} from '@/lib/invoices/invoice-totals'
import {
  paymentRefsUnchanged,
  stopOpenInvoicePayments,
  stopPaymentsRefusal,
} from '@/lib/invoices/stop-open-payments'
import { companies, invoices, invoiceLineItems } from '@/lib/db/schema'

import { invoiceSchema } from './schemas'
import type { ActionResult, InvoiceInput } from './types'
import { INVOICES_PATH } from './helpers'

export async function saveInvoice(input: InvoiceInput): Promise<ActionResult> {
  const mode = input.id ? 'edit' : 'create'
  const targetId = input.id ?? null

  return trackSettingsServerInteraction(
    {
      entity: 'invoice',
      mode,
      targetId,
      metadata: {
        companyId: input.companyId,
      },
    },
    async () => performSaveInvoice(input)
  )
}

async function performSaveInvoice(input: InvoiceInput): Promise<ActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = invoiceSchema.safeParse(input)

  if (!parsed.success) {
    const { fieldErrors, formErrors } = parsed.error.flatten()
    const message = formErrors[0] ?? 'Please correct the highlighted fields.'

    return { error: message, fieldErrors }
  }

  const { id, companyId, notes } = parsed.data
  // Round to what the columns hold (2 and 4 decimals), then price from that,
  // so the stored amount is exactly quantity × unit price.
  const taxRate = Math.round(parsed.data.taxRate * 10_000) / 10_000
  const lineItems = parsed.data.lineItems.map(item => {
    const quantity = Math.round(item.quantity * 100) / 100
    const unitPrice = Math.round(item.unitPrice * 100) / 100
    return {
      ...item,
      quantity,
      unitPrice,
      amount: centsToAmount(lineItemCents(quantity, unitPrice)),
    }
  })
  if (lineItems.some(item => item.quantity <= 0)) {
    return { error: 'Quantity must be at least 0.01.' }
  }

  const notClient = await ensureClientCompany(companyId)
  if (notClient) {
    return { error: notClient }
  }

  const clientRows = await db
    .select({
      id: companies.id,
      name: companies.name,
      billingType: currentBillingTypeSql(),
    })
    .from(companies)
    .where(and(isClientCompany(), eq(companies.id, companyId)))
    .limit(1)

  const client = clientRows[0]

  if (!client) {
    return { error: 'Selected client could not be found.' }
  }

  const targetClientName = client.name
  const nowIso = new Date().toISOString()

  const { subtotal, taxAmount, total } = invoiceTotals(lineItems, taxRate)
  let savedId = id

  if (!id) {
    try {
      const [inserted] = await db.transaction(async tx => {
        const seqResult = await tx.execute(
          sql`SELECT nextval('invoice_number_seq')`
        )
        const seqValue = (seqResult[0] as { nextval: string } | undefined)
          ?.nextval
        if (!seqValue) {
          throw new Error('Failed to generate invoice number.')
        }
        const invoiceNumber = `INV-${String(seqValue).padStart(4, '0')}`

        const [inv] = await tx
          .insert(invoices)
          .values({
            companyId: companyId,
            invoiceNumber,
            billingType: client.billingType,
            notes: notes ?? null,
            taxRate: taxRate.toString(),
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2),
            createdBy: user.id,
          })
          .returning({ id: invoices.id })

        if (!inv) {
          throw new Error('Unable to create invoice.')
        }

        if (lineItems.length > 0) {
          await tx.insert(invoiceLineItems).values(
            lineItems.map(item => ({
              invoiceId: inv.id,
              productCatalogItemId: item.productCatalogItemId ?? null,
              description: item.description,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toFixed(2),
              amount: item.amount.toFixed(2),
              createsHourBlock: item.createsHourBlock,
              sortOrder: item.sortOrder,
            }))
          )
        }

        return [inv]
      })

      if (!inserted) {
        throw new Error('Unable to create invoice.')
      }
      savedId = inserted.id

      const event = invoiceCreatedEvent({
        clientName: targetClientName,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'INVOICE',
        targetId: inserted.id,
        targetCompanyId: companyId,
        metadata: event.metadata,
      })
    } catch (error) {
      console.error('Failed to create invoice', error)

      return {
        error:
          error instanceof Error ? error.message : 'Unable to create invoice.',
      }
    }
  } else {
    const existingRows = await db
      .select({
        id: invoices.id,
        status: invoices.status,
        companyId: invoices.companyId,
        invoiceNumber: invoices.invoiceNumber,
        notes: invoices.notes,
        taxRate: invoices.taxRate,
        subtotal: invoices.subtotal,
        total: invoices.total,
        stripePaymentIntentId: invoices.stripePaymentIntentId,
        stripeCheckoutSessionId: invoices.stripeCheckoutSessionId,
      })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1)

    const existing = existingRows[0]

    if (!existing) {
      return { error: 'Invoice not found.' }
    }

    if (existing.status === 'PAID') {
      return { error: 'Paid invoices cannot be edited.' }
    }

    if (existing.status === 'VOID') {
      return { error: 'Void invoices cannot be edited.' }
    }

    // A payment the client has open was made for the old total. Stop it
    // before its ids are dropped, or nothing could stop it later.
    const refs = {
      paymentIntentId: existing.stripePaymentIntentId,
      checkoutSessionId: existing.stripeCheckoutSessionId,
    }
    if (refs.paymentIntentId || refs.checkoutSessionId) {
      const stopped = await stopOpenInvoicePayments(refs)
      if (stopped !== 'clear') {
        return { error: stopPaymentsRefusal(stopped, 'edited') }
      }
    }

    try {
      await db.transaction(async tx => {
        const updateData: Record<string, unknown> = {
          companyId,
          notes: notes ?? null,
          taxRate: taxRate.toString(),
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          updatedAt: nowIso,
        }

        // Re-sync billing type when client changes
        if (existing.companyId !== companyId) {
          updateData.billingType = client.billingType
        }

        // Stopped above: checkout makes new ones for the new total.
        updateData.stripePaymentIntentId = null
        updateData.stripeCheckoutSessionId = null

        // Conditional, so a payment, void or new checkout that landed
        // meanwhile is not overwritten.
        const updated = await tx
          .update(invoices)
          .set(updateData)
          .where(
            and(
              eq(invoices.id, id),
              eq(invoices.status, existing.status),
              paymentRefsUnchanged(refs)
            )
          )
          .returning({ id: invoices.id })
        if (updated.length === 0) {
          throw new Error(
            'This invoice changed while you were working on it. Refresh and try again.'
          )
        }

        const existingLineItemRows = await tx
          .select({ id: invoiceLineItems.id })
          .from(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.invoiceId, id),
              isNull(invoiceLineItems.deletedAt)
            )
          )

        const existingLineItemIds = new Set(
          existingLineItemRows.map(row => row.id)
        )

        const incomingLineItemIds = new Set(
          lineItems.filter(item => item.id).map(item => item.id!)
        )

        const removedIds = [...existingLineItemIds].filter(
          existingId => !incomingLineItemIds.has(existingId)
        )

        if (removedIds.length > 0) {
          await tx
            .update(invoiceLineItems)
            .set({ deletedAt: nowIso, updatedAt: nowIso })
            .where(inArray(invoiceLineItems.id, removedIds))
        }

        for (const item of lineItems) {
          if (item.id && existingLineItemIds.has(item.id)) {
            await tx
              .update(invoiceLineItems)
              .set({
                productCatalogItemId: item.productCatalogItemId ?? null,
                description: item.description,
                quantity: item.quantity.toString(),
                unitPrice: item.unitPrice.toFixed(2),
                amount: item.amount.toFixed(2),
                createsHourBlock: item.createsHourBlock,
                sortOrder: item.sortOrder,
                updatedAt: nowIso,
              })
              .where(eq(invoiceLineItems.id, item.id))
          } else {
            await tx.insert(invoiceLineItems).values({
              invoiceId: id,
              productCatalogItemId: item.productCatalogItemId ?? null,
              description: item.description,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toFixed(2),
              amount: item.amount.toFixed(2),
              createsHourBlock: item.createsHourBlock,
              sortOrder: item.sortOrder,
            })
          }
        }
      })
    } catch (error) {
      console.error('Failed to update invoice', error)

      return {
        error:
          error instanceof Error ? error.message : 'Unable to update invoice.',
      }
    }

    const changedFields: string[] = []
    const previousDetails: Record<string, unknown> = {}
    const nextDetails: Record<string, unknown> = {}

    if (existing.companyId !== companyId) {
      changedFields.push('client')
      previousDetails.companyId = existing.companyId
      nextDetails.companyId = companyId
      nextDetails.clientName = targetClientName
    }

    if ((existing.notes ?? null) !== (notes ?? null)) {
      changedFields.push('notes')
      previousDetails.notes = existing.notes ?? null
      nextDetails.notes = notes ?? null
    }

    const taxRateChanged = existing.taxRate !== taxRate.toString()
    const lineItemsChanged = existing.subtotal !== subtotal.toFixed(2)
    const totalChanged = existing.total !== total.toFixed(2)

    if (taxRateChanged) {
      changedFields.push('tax rate')
      previousDetails.taxRate = existing.taxRate
      nextDetails.taxRate = taxRate.toString()
    }

    if (lineItemsChanged) {
      changedFields.push('line items')
      previousDetails.subtotal = existing.subtotal
      nextDetails.subtotal = subtotal.toFixed(2)
    }

    // The total is a consequence of the line items or the tax rate, so it
    // only earns its own badge when neither of those explains the movement.
    if (totalChanged) {
      previousDetails.total = existing.total
      nextDetails.total = total.toFixed(2)

      if (!taxRateChanged && !lineItemsChanged) {
        changedFields.push('total')
      }
    }

    if (changedFields.length > 0) {
      const hasDetails =
        Object.keys(previousDetails).length > 0 ||
        Object.keys(nextDetails).length > 0

      const event = invoiceUpdatedEvent({
        invoiceNumber: existing.invoiceNumber,
        changedFields,
        details: hasDetails
          ? { before: previousDetails, after: nextDetails }
          : undefined,
      })

      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        verb: event.verb,
        summary: event.summary,
        targetType: 'INVOICE',
        targetId: id,
        targetCompanyId: companyId,
        metadata: event.metadata,
      })
    }
  }

  revalidatePath(INVOICES_PATH)

  return { id: savedId }
}
