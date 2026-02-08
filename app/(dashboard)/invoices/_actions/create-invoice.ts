'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { createDraftInvoice } from '@/lib/data/invoices'

export type CreateInvoiceResult = {
  success: boolean
  invoiceId?: string
  error?: string
}

type LineItemInput = {
  type: 'HOURS_PREPAID' | 'HOURS_WORKED' | 'CUSTOM'
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

export async function createInvoiceAction(input: {
  clientId: string
  dueDate?: string | null
  billingPeriodStart?: string | null
  billingPeriodEnd?: string | null
  notes?: string | null
  internalNotes?: string | null
  lineItems: LineItemInput[]
}): Promise<CreateInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  if (!input.clientId) {
    return { success: false, error: 'Client is required.' }
  }

  if (!input.lineItems.length) {
    return { success: false, error: 'At least one line item is required.' }
  }

  const invoice = await createDraftInvoice(
    {
      clientId: input.clientId,
      createdBy: user.id,
      dueDate: input.dueDate,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      notes: input.notes,
      internalNotes: input.internalNotes,
      lineItems: input.lineItems,
    },
    user.id
  )

  if (!invoice) {
    return { success: false, error: 'Failed to create invoice.' }
  }

  revalidatePath('/invoices')
  return { success: true, invoiceId: invoice.id }
}
