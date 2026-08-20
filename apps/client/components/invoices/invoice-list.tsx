import { Download, ExternalLink, FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getInvoiceStatusLabel,
  getInvoiceStatusToken,
} from '@/lib/invoices/status'
import type { ClientInvoice } from '@/lib/data/invoices'

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/**
 * Issued is a date-only column. Appending the time forces it to parse as
 * local midnight instead of UTC, which is what keeps the date from rendering
 * a day early — the same guard the PDF generator uses.
 */
function formatDate(value: string | null): string {
  if (!value) return '—'
  return DATE_FORMATTER.format(new Date(`${value}T00:00:00`))
}

type InvoiceListProps = {
  invoices: ClientInvoice[]
  /** Base URL of the internal portal, which hosts the shared payment page. */
  internalPortalUrl: string
}

/**
 * Invoice rows with no surface of their own — callers supply the container.
 * Shared by /invoices (inside a bordered card) and the dashboard's expandable
 * Invoices row, so both render identically.
 */
export function InvoiceList({ invoices, internalPortalUrl }: InvoiceListProps) {
  return (
    <ul className="divide-y divide-border">
      {invoices.map(invoice => (
        <InvoiceRow
          key={invoice.id}
          invoice={invoice}
          internalPortalUrl={internalPortalUrl}
        />
      ))}
    </ul>
  )
}

function InvoiceRow({
  invoice,
  internalPortalUrl,
}: {
  invoice: ClientInvoice
  internalPortalUrl: string
}) {
  const isOwed = invoice.status === 'SENT' || invoice.status === 'VIEWED'
  const pdfHref = `/api/invoices/${invoice.id}/pdf`

  return (
    // py-2.5 matches TaskRows, so invoice and task accordions have the same
    // row rhythm. The action buttons are size-8, which sets the real floor
    // here — the padding was doing nothing but adding height.
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-card-foreground">
            {invoice.invoiceNumber ?? 'Invoice'}
          </span>
          <Badge
            variant="secondary"
            className={cn('shrink-0', getInvoiceStatusToken(invoice.status))}
          >
            {getInvoiceStatusLabel(invoice.status)}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Issued {formatDate(invoice.issuedDate)}
        </p>

        {/* An unpaid invoice with no live share link has nowhere to send them,
            and a silently missing Pay button reads as a bug. */}
        {isOwed && !invoice.isPayable && (
          <p className="text-xs text-muted-foreground">
            Payment link unavailable — contact your account manager.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
        <span className="text-sm font-semibold tabular-nums text-card-foreground">
          {CURRENCY_FORMATTER.format(Number(invoice.total))}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            aria-label={`View ${invoice.invoiceNumber ?? 'invoice'} as a PDF`}
          >
            <FileText aria-hidden="true" />
            View
          </a>

          {/* Icon-only: the inline viewer that "View" opens has its own
              download control on desktop, so this mainly exists for mobile,
              where inline PDF handling varies by browser. title + aria-label
              carry the label for hover and assistive tech respectively. */}
          <a
            href={`${pdfHref}?download=1`}
            download
            className={cn(
              buttonVariants({ variant: 'outline', size: 'icon-sm' })
            )}
            title="Download PDF"
            aria-label={`Download ${invoice.invoiceNumber ?? 'invoice'} as a PDF`}
          >
            <Download aria-hidden="true" />
          </a>

          {invoice.isPayable && (
            <a
              href={`${internalPortalUrl}/share/invoices/${invoice.shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm' }))}
              aria-label={`Pay ${invoice.invoiceNumber ?? 'invoice'}`}
            >
              Pay
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </li>
  )
}
