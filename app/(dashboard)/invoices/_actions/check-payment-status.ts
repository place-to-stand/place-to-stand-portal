'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchInvoiceById } from '@/lib/queries/invoices'
import { getPaymentIntent } from '@/lib/integrations/stripe/payment-intents'
import { markInvoicePaid } from '@/lib/data/invoices/mark-paid'

export type CheckPaymentStatusResult = {
  success: boolean
  status?: string
  error?: string
}

/**
 * Polling fallback: check Stripe for payment status and sync to invoice.
 */
export async function checkPaymentStatusAction(
  invoiceId: string
): Promise<CheckPaymentStatusResult> {
  const user = await requireUser()
  assertAdmin(user)

  const invoice = await fetchInvoiceById(invoiceId)
  if (!invoice) {
    return { success: false, error: 'Invoice not found.' }
  }

  if (invoice.status === 'PAID') {
    return { success: true, status: 'PAID' }
  }

  if (!invoice.stripePaymentIntentId) {
    return { success: false, error: 'No payment has been initiated for this invoice.' }
  }

  try {
    const pi = await getPaymentIntent(invoice.stripePaymentIntentId)

    if (pi.status === 'succeeded') {
      await markInvoicePaid(pi.id, pi.payment_method_types?.[0])
      revalidatePath('/invoices')
      return { success: true, status: 'PAID' }
    }

    return { success: true, status: pi.status }
  } catch (err) {
    console.error('[check-payment] Error checking PI status:', err)
    return { success: false, error: 'Failed to check payment status.' }
  }
}
