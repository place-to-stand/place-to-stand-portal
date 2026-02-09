import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { fetchInvoiceByShareToken } from '@/lib/queries/invoices'
import { fetchBillingSettings } from '@/lib/queries/billing-settings'
import { markInvoiceViewed } from '@/lib/data/invoices'
import { InvoicePublicView } from './invoice-public-view'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Invoice',
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params

  const invoice = await fetchInvoiceByShareToken(shareToken)
  if (!invoice) notFound()

  const settings = await fetchBillingSettings()

  // Record view (SENT → VIEWED)
  await markInvoiceViewed(invoice.id)

  return (
    <InvoicePublicView
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        sentAt: invoice.sentAt,
        notes: invoice.notes,
        client: invoice.client
          ? { name: invoice.client.name }
          : null,
        lineItems: invoice.lineItems.map(item => ({
          id: item.id,
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      }}
      company={{
        name: settings?.companyName ?? 'Place To Stand',
        address: settings?.companyAddress ?? null,
        logoUrl: settings?.companyLogoUrl ?? null,
      }}
      shareToken={shareToken}
    />
  )
}
