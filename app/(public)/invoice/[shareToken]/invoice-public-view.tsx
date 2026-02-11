'use client'

import { LINE_ITEM_TYPE_LABELS } from '@/lib/invoices/constants'

type PublicInvoiceData = {
  id: string
  invoiceNumber: string | null
  status: string
  subtotal: string
  tax: string
  total: string
  currency: string | null
  dueDate: string | null
  paidAt: string | null
  sentAt: string | null
  notes: string | null
  client: { name: string } | null
  lineItems: {
    id: string
    type: string
    description: string
    quantity: string
    unitPrice: string
    amount: string
  }[]
}

type CompanyInfo = {
  name: string
  address: string | null
  logoUrl: string | null
}

export function InvoicePublicView({
  invoice,
  company,
  shareToken,
}: {
  invoice: PublicInvoiceData
  company: CompanyInfo
  shareToken: string
}) {
  const isPaid = invoice.status === 'PAID'
  const isPayable = !['PAID', 'VOID', 'REFUNDED'].includes(invoice.status)

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency ?? 'USD',
    }).format(Number(amount))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="mb-2 h-10 w-auto"
            />
          ) : (
            <h1 className="text-2xl font-bold">{company.name}</h1>
          )}
          {company.address && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
              {company.address}
            </p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold">Invoice</h2>
          {invoice.invoiceNumber && (
            <p className="text-sm text-muted-foreground">
              {invoice.invoiceNumber}
            </p>
          )}
        </div>
      </div>

      {/* Client & dates */}
      <div className="flex justify-between border-t pt-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Bill To</p>
          <p className="text-lg font-semibold">
            {invoice.client?.name ?? 'Client'}
          </p>
        </div>
        <div className="text-right space-y-1">
          {invoice.sentAt && (
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-sm">
                {new Date(invoice.sentAt).toLocaleDateString()}
              </p>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="text-sm">
                {new Date(invoice.dueDate + 'T00:00:00').toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status badge */}
      {isPaid && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
          <p className="text-lg font-semibold text-green-700 dark:text-green-300">
            Paid
            {invoice.paidAt && (
              <span className="ml-2 text-sm font-normal">
                on {new Date(invoice.paidAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Line items table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">
                Description
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium">
                Type
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">
                Qty
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">
                Rate
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map(item => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-sm">{item.description}</td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                  {LINE_ITEM_TYPE_LABELS[item.type] ?? item.type}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {Number(item.quantity)}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {Number(invoice.tax) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(invoice.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* Payment section placeholder */}
      {isPayable && (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Payment processing via Stripe will be available once Stripe keys are
            configured.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Total due: {formatCurrency(invoice.total)}
          </p>
        </div>
      )}
    </div>
  )
}
