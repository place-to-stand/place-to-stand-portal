'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { voidInvoice } from '@/lib/data/invoices'

export type VoidInvoiceResult = {
  success: boolean
  error?: string
}

export async function voidInvoiceAction(
  invoiceId: string
): Promise<VoidInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  const voided = await voidInvoice(invoiceId, user.id)
  if (!voided) {
    return { success: false, error: 'Invoice not found or cannot be voided.' }
  }

  revalidatePath('/invoices')
  return { success: true }
}
