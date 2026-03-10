'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react'

import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type PublicInvoiceProps = {
  invoice: InvoiceWithLineItems
  shareToken: string
  paymentStatus?: 'success' | 'cancelled' | null
}

const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? Number(value) : value)

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTaxRate = (taxRate: string | null) => {
  if (!taxRate) return '0'
  const rate = Number(taxRate) * 100
  // Remove trailing zeros (e.g. 10.00 -> 10, 7.50 -> 7.5)
  return rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2).replace(/0+$/, '')
}

export function PublicInvoice({
  invoice,
  shareToken,
  paymentStatus,
}: PublicInvoiceProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  const isVoid = invoice.status === 'VOID'
  const isPaid = invoice.status === 'PAID'
  const isPayable = invoice.status === 'SENT' || invoice.status === 'VIEWED'

  const handlePayNow = async () => {
    setIsRedirecting(true)
    try {
      const res = await fetch(`/api/public/invoices/${shareToken}/checkout`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.ok && data.data?.url) {
        window.location.href = data.data.url
      } else {
        console.error('[public-invoice] Checkout failed:', data.error)
        setIsRedirecting(false)
      }
    } catch (err) {
      console.error('[public-invoice] Checkout error:', err)
      setIsRedirecting(false)
    }
  }

  return (
    <div className={isVoid ? 'opacity-60' : undefined}>
      {/* Payment status banners */}
      {paymentStatus === 'success' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-sm font-medium">Payment received! Thank you.</p>
        </div>
      )}

      {paymentStatus === 'cancelled' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            Payment was cancelled. You can try again below.
          </p>
        </div>
      )}

      {/* Invoice header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">INVOICE</h1>
          {invoice.invoice_number && (
            <p className="mt-1 text-lg text-muted-foreground">
              {invoice.invoice_number}
            </p>
          )}
        </div>

        <div className="text-sm text-muted-foreground sm:text-right">
          {invoice.issued_date && (
            <p>
              <span className="font-medium text-foreground">Issued:</span>{' '}
              {formatDate(invoice.issued_date)}
            </p>
          )}
          {invoice.due_date && (
            <p className="mt-1">
              <span className="font-medium text-foreground">Due:</span>{' '}
              {formatDate(invoice.due_date)}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Bill To */}
      {invoice.client?.name && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bill To
          </p>
          <p className="mt-1 text-base font-medium">{invoice.client.name}</p>
        </div>
      )}

      {/* Line items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Description</th>
              <th className="pb-3 pr-4 text-right font-medium">Qty</th>
              <th className="pb-3 pr-4 text-right font-medium">Unit Price</th>
              <th className="pb-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-3 pr-4">{item.description}</td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {Number(item.quantity)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Tax ({formatTaxRate(invoice.tax_rate)}%)
            </span>
            <span className="tabular-nums">
              {formatCurrency(invoice.tax_amount)}
            </span>
          </div>

          <Separator />

          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {invoice.notes}
          </p>
        </div>
      )}

      {/* Payment section */}
      <Separator className="my-8" />

      <div className="flex flex-col items-center gap-4">
        {isPayable && (
          <Button
            size="lg"
            onClick={handlePayNow}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="animate-spin" />
                Redirecting to payment...
              </>
            ) : (
              'Pay Now'
            )}
          </Button>
        )}

        {isPaid && (
          <div className="flex flex-col items-center gap-2">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle2 className="size-3" />
              Paid
            </Badge>
            {invoice.paid_at && (
              <p className="text-sm text-muted-foreground">
                Paid on {formatDate(invoice.paid_at)}
              </p>
            )}
          </div>
        )}

        {isVoid && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="size-4" />
            <p className="text-sm">This invoice has been voided.</p>
          </div>
        )}
      </div>
    </div>
  )
}
