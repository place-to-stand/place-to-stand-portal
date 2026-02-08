import 'server-only'

import { generateShareToken } from '@/lib/sharing/tokens'
import { fetchInvoiceById, updateInvoice } from '@/lib/queries/invoices'

export async function enableInvoiceSharing(
  invoiceId: string
): Promise<{ shareToken: string } | null> {
  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) return null

  const shareToken = invoice.shareToken ?? generateShareToken()

  await updateInvoice(invoiceId, {
    shareToken,
    shareEnabled: true,
  })

  return { shareToken }
}

export async function disableInvoiceSharing(
  invoiceId: string
): Promise<boolean> {
  const result = await updateInvoice(invoiceId, { shareEnabled: false })
  return result !== null
}
