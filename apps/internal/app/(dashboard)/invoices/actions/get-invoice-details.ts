'use server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getInvoiceById } from '@/lib/queries/invoices'

import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'

export async function getInvoiceDetails(
  id: string,
): Promise<InvoiceWithLineItems | null> {
  const user = await requireUser()
  assertAdmin(user)

  return getInvoiceById(user, id)
}
