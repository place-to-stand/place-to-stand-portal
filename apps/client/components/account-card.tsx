import { HoursSummaryContent } from '@/components/hours/hours-summary-card'
import { NavRow } from '@/components/ui/nav-row'
import { cn } from '@/lib/utils'
import type { ClientHoursSummary } from '@/lib/data/hours'
import type { ClientInvoiceSummary } from '@/lib/data/invoices'

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function invoiceLine(summary: ClientInvoiceSummary): string {
  if (summary.unpaidCount > 0) {
    return `${summary.unpaidCount} unpaid · ${CURRENCY_FORMATTER.format(Number(summary.unpaidTotal))}`
  }

  return 'All paid'
}

/**
 * Hours balance (read-only rows) plus a row through to the invoices page.
 *
 * Everything account-related shares one bordered container rather than
 * floating as separate blocks.
 */
export function AccountCard({
  hoursSummaries,
  invoiceSummary,
  showClientName,
  className,
}: {
  hoursSummaries: ClientHoursSummary[]
  invoiceSummary: ClientInvoiceSummary
  showClientName: boolean
  className?: string
}) {
  const text = invoiceLine(invoiceSummary)

  return (
    <div
      className={cn(
        'divide-y divide-border overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
    >
      {hoursSummaries.map(summary => (
        <HoursSummaryContent
          key={summary.clientId}
          summary={summary}
          showClientName={showClientName}
        />
      ))}

      <NavRow
        href="/invoices"
        title="Invoices"
        meta={
          <span className='truncate text-sm text-muted-foreground'>
            {text}
          </span>
        }
      />
    </div>
  )
}
