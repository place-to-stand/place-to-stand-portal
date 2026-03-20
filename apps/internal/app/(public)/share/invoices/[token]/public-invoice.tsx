'use client'

import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

import type { InvoiceWithLineItems } from '@/lib/invoices/invoice-form'
import { Badge } from '@/components/ui/badge'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

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
  return rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(2).replace(/0+$/, '')
}

// ---------------------------------------------------------------------------
// Payment form (rendered inside <Elements> provider)
// ---------------------------------------------------------------------------

function PaymentForm({
  total,
  returnUrl,
}: {
  total: string
  returnUrl: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
    }
    setIsProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50"
      >
        {isProcessing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>Pay {formatCurrency(total)}</>
        )}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Secured by Stripe
      </p>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Public invoice page
// ---------------------------------------------------------------------------

export function PublicInvoice({
  invoice,
  shareToken,
  paymentStatus,
}: PublicInvoiceProps) {
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isFetchingSecret, setIsFetchingSecret] = useState(false)

  const isDraft = invoice.status === 'DRAFT'
  const isVoid = invoice.status === 'VOID'
  // When redirected back from Stripe with success, treat as paid even if the
  // webhook hasn't updated the DB status yet (race between redirect & webhook).
  const isPaid = invoice.status === 'PAID' || paymentStatus === 'success'
  const isPayable =
    !isPaid && (invoice.status === 'SENT' || invoice.status === 'VIEWED')

  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!isPayable || fetchedRef.current) return
    fetchedRef.current = true
    setIsFetchingSecret(true)

    fetch(`/api/public/invoices/${shareToken}/checkout`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !data.data?.clientSecret) {
          setCheckoutError(data.error ?? 'Unable to start checkout.')
          return
        }
        setClientSecret(data.data.clientSecret)
      })
      .catch(() => {
        setCheckoutError('Unable to connect to payment provider.')
      })
      .finally(() => {
        setIsFetchingSecret(false)
      })
  }, [isPayable, shareToken])

  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/invoices/${shareToken}?payment=success`
      : ''

  const isDarkMode =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')

  const showPaymentColumn = isPayable && stripePromise
  const hasTax = invoice.tax_rate && Number(invoice.tax_rate) > 0

  return (
    <div className={isVoid ? 'opacity-60' : undefined}>
      {/* ── Status banners ── */}
      {paymentStatus === 'cancelled' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            Payment was cancelled. You can try again below.
          </p>
        </div>
      )}

      {isDraft && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            This invoice is a draft and has not been finalized. Payment is not
            available until the invoice is issued.
          </p>
        </div>
      )}

      {isVoid && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <XCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            This invoice has been voided and is no longer payable.
          </p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div
        className={
          showPaymentColumn
            ? 'grid items-start gap-6 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px]'
            : undefined
        }
      >
        {/* ── Invoice card ── */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Invoice
              </p>
              {invoice.invoice_number && (
                <p className="mt-0.5 font-mono text-xl font-bold tracking-tight">
                  {invoice.invoice_number}
                </p>
              )}
            </div>

            <div className="flex gap-4 text-sm sm:flex-col sm:gap-1 sm:text-right">
              {invoice.issued_date && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Issued</span>{' '}
                  {formatDate(invoice.issued_date)}
                </p>
              )}
              {invoice.due_date && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Due</span>{' '}
                  {formatDate(invoice.due_date)}
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          {invoice.client?.name && (
            <div className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Bill To
              </p>
              <p className="mt-1 text-base font-medium">
                {invoice.client.name}
              </p>
            </div>
          )}

          {/* Line items */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                  Description
                </th>
                <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wider">
                  Qty
                </th>
                <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wider">
                  Rate
                </th>
                <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item) => (
                <tr key={item.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-4">{item.description}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(item.quantity)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="py-3 text-right font-mono font-medium tabular-nums">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[240px] space-y-1.5 text-sm">
              {hasTax && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({formatTaxRate(invoice.tax_rate)}%)</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 border-t border-border/40 pt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Notes
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Paid / Void status */}
          {(isPaid || isVoid) && (
            <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/40 pt-6">
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
          )}
        </div>

        {/* ── Payment column ── */}
        {showPaymentColumn && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm md:sticky md:top-6">
            <p className="mb-4 text-sm font-semibold">Payment</p>

            {checkoutError && (
              <p className="mb-4 text-sm text-destructive">{checkoutError}</p>
            )}

            {isFetchingSecret && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  fonts: [
                    {
                      cssSrc:
                        'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
                    },
                  ],
                  appearance: {
                    theme: isDarkMode ? 'night' : 'stripe',
                    variables: {
                      borderRadius: '8px',
                      colorPrimary: isDarkMode ? '#e4e4e7' : '#18181b',
                      fontFamily: 'Geist, system-ui, sans-serif',
                    },
                  },
                }}
              >
                <PaymentForm total={invoice.total} returnUrl={returnUrl} />
              </Elements>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
