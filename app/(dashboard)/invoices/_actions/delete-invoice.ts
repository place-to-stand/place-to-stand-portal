'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { deleteDraftInvoice } from '@/lib/data/invoices'

export type DeleteInvoiceResult = {
  success: boolean
  error?: string
}

export async function deleteInvoiceAction(
  invoiceId: string
): Promise<DeleteInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  const deleted = await deleteDraftInvoice(invoiceId)
  if (!deleted) {
    return { success: false, error: 'Invoice not found or cannot be deleted.' }
  }

  revalidatePath('/invoices')
  return { success: true }
}
