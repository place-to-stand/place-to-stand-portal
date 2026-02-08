'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { duplicateInvoice } from '@/lib/data/invoices'

export type DuplicateInvoiceResult = {
  success: boolean
  invoiceId?: string
  error?: string
}

export async function duplicateInvoiceAction(
  invoiceId: string
): Promise<DuplicateInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  const newInvoice = await duplicateInvoice(invoiceId, user.id)
  if (!newInvoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  revalidatePath('/invoices')
  return { success: true, invoiceId: newInvoice.id }
}
