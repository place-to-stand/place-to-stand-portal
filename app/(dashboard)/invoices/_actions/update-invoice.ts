'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  fetchInvoiceById,
  updateInvoice,
  createLineItems,
  softDeleteLineItem,
  recomputeInvoiceTotals,
} from '@/lib/queries/invoices'
import { isImmutable } from '@/lib/invoices/constants'

export type UpdateInvoiceResult = {
  success: boolean
  error?: string
}

type LineItemInput = {
  type: 'HOURS_PREPAID' | 'HOURS_WORKED' | 'CUSTOM'
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

export async function updateInvoiceAction(
  invoiceId: string,
  input: {
    dueDate?: string | null
    billingPeriodStart?: string | null
    billingPeriodEnd?: string | null
    notes?: string | null
    internalNotes?: string | null
    lineItems?: LineItemInput[]
  }
): Promise<UpdateInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (isImmutable(invoice.status)) {
    return { success: false, error: 'Invoice cannot be modified in its current status.' }
  }

  await updateInvoice(invoiceId, {
    dueDate: input.dueDate ?? null,
    billingPeriodStart: input.billingPeriodStart ?? null,
    billingPeriodEnd: input.billingPeriodEnd ?? null,
    notes: input.notes ?? null,
    internalNotes: input.internalNotes ?? null,
  })

  // Replace line items if provided
  if (input.lineItems) {
    // Soft-delete existing line items
    for (const li of invoice.lineItems) {
      await softDeleteLineItem(li.id)
    }

    // Create new line items
    if (input.lineItems.length > 0) {
      await createLineItems(
        input.lineItems.map((li, idx) => ({
          invoiceId,
          type: li.type,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.amount,
          sortOrder: idx,
        }))
      )
    }

    await recomputeInvoiceTotals(invoiceId)
  }

  revalidatePath('/invoices')
  return { success: true }
}
