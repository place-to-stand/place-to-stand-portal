import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { fetchInvoiceByShareToken, recordInvoiceView } from '@/lib/queries/invoices'
import { fetchCachedBillingSettings } from '@/lib/data/billing-settings'

import { InvoiceDocument } from './invoice-document'
import { InvoiceClient } from './invoice-client'

type Props = {
  params: Promise<{ shareToken: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareToken } = await params
  const invoice = await fetchInvoiceByShareToken(shareToken)

  return {
    title: invoice
      ? `Invoice ${invoice.invoiceNumber ?? ''} — Place To Stand`
      : 'Invoice',
    robots: { index: false, follow: false },
  }
}

export default async function PublicInvoicePage({ params }: Props) {
  const { shareToken } = await params
  const [invoice, billingSettings] = await Promise.all([
    fetchInvoiceByShareToken(shareToken),
    fetchCachedBillingSettings(),
  ])

  if (!invoice) {
    notFound()
  }

  // Record view (SENT→VIEWED) — fire-and-forget
  if (invoice.status === 'SENT' || invoice.status === 'VIEWED') {
    recordInvoiceView(invoice.id, invoice.status).catch(err => {
      console.error('[public-invoice] Failed to record view:', err)
    })
  }

  const isPaid = invoice.status === 'PAID'
  const isVoid = invoice.status === 'VOID'
  const canPay = !isPaid && !isVoid && invoice.status !== 'REFUNDED'

  return (
    <div className='space-y-8'>
      <InvoiceDocument
        invoice={invoice}
        billingSettings={billingSettings}
      />

      {canPay && (
        <InvoiceClient
          shareToken={shareToken}
          total={invoice.total}
          currency={invoice.currency}
          invoiceNumber={invoice.invoiceNumber}
        />
      )}

      {isPaid && (
        <div className='rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950'>
          <p className='text-lg font-semibold text-green-700 dark:text-green-300'>
            Payment Received
          </p>
          <p className='text-sm text-green-600 dark:text-green-400 mt-1'>
            Thank you! This invoice has been paid
            {invoice.paidAt && ` on ${new Date(invoice.paidAt).toLocaleDateString()}`}.
          </p>
        </div>
      )}

      {isVoid && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950'>
          <p className='text-lg font-semibold text-red-700 dark:text-red-300'>
            Invoice Voided
          </p>
          <p className='text-sm text-red-600 dark:text-red-400 mt-1'>
            This invoice has been voided and is no longer payable.
          </p>
        </div>
      )}
    </div>
  )
}
