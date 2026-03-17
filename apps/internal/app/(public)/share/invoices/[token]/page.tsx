import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { getInvoiceByShareToken, recordInvoiceView } from '@/lib/queries/invoices'
import { getSession } from '@/lib/auth/session'
import { invoiceViewedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'

import { PublicInvoice } from './public-invoice'

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const invoice = await getInvoiceByShareToken(token)

  return {
    title: invoice?.invoice_number
      ? `Invoice ${invoice.invoice_number} | Place to Stand`
      : 'Invoice | Place to Stand',
    robots: { index: false, follow: false },
  }
}

export default async function PublicInvoicePage({ params, searchParams }: Props) {
  const { token } = await params
  const invoice = await getInvoiceByShareToken(token)

  if (!invoice) {
    notFound()
  }

  // Skip view tracking for authenticated users (admins previewing their own invoices)
  const session = await getSession()

  if (!session) {
    recordInvoiceView(invoice.id)
      .then((previousCount) => {
        // Log activity only for the first view
        if (previousCount === 0) {
          const event = invoiceViewedEvent({
            invoiceNumber: invoice.invoice_number,
            viewCount: 1,
          })

          return logActivity({
            actorId: invoice.created_by ?? invoice.id,
            verb: event.verb,
            summary: event.summary,
            targetType: 'INVOICE',
            targetId: invoice.id,
            targetClientId: invoice.client?.id ?? null,
            metadata: event.metadata,
          })
        }
      })
      .catch((err) => {
        console.error(
          '[invoice-view] Failed to record view for invoice',
          invoice.id,
          err
        )
      })
  }

  const resolvedSearchParams = await searchParams
  const paymentParam = resolvedSearchParams.payment

  let paymentStatus: 'success' | 'cancelled' | null = null
  if (paymentParam === 'success') {
    paymentStatus = 'success'
  } else if (paymentParam === 'cancelled') {
    paymentStatus = 'cancelled'
  }

  return (
    <PublicInvoice
      invoice={invoice}
      shareToken={token}
      paymentStatus={paymentStatus}
    />
  )
}
