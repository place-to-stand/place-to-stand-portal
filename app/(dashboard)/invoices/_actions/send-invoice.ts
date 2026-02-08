'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { sendInvoice } from '@/lib/data/invoices'

export type SendInvoiceResult = {
  success: boolean
  error?: string
}

export async function sendInvoiceAction(
  invoiceId: string,
  recipientEmail?: string
): Promise<SendInvoiceResult> {
  const user = await requireUser()
  assertAdmin(user)

  const invoice = await sendInvoice(invoiceId, user.id)
  if (!invoice) {
    return { success: false, error: 'Invoice not found or cannot be sent.' }
  }

  // Send email if recipient provided and sharing is enabled
  if (recipientEmail && invoice.shareToken && invoice.shareEnabled) {
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
    const shareUrl = `${baseUrl}/invoice/${invoice.shareToken}`

    // Fire-and-forget email
    import('@/lib/email/send-invoice-link')
      .then(({ sendInvoiceLinkEmail }) =>
        sendInvoiceLinkEmail({
          to: recipientEmail,
          invoiceNumber: invoice.invoiceNumber ?? 'Draft',
          total: invoice.total,
          dueDate: invoice.dueDate,
          shareUrl,
        })
      )
      .catch(err => {
        console.error('[send-invoice] Failed to send email:', err)
      })
  }

  revalidatePath('/invoices')
  return { success: true }
}
