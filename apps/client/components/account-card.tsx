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

/**
 * Overdue replaces the neutral line rather than adding to it — if something is
 * late that is the whole message. The amount beside "overdue" is the overdue
 * subset, not the full balance, so both numbers describe the same invoices.
 */
function invoiceLine(summary: ClientInvoiceSummary): {
  text: string
  isUrgent: boolean
} {
  if (summary.overdueCount > 0) {
    return {
      text: `${summary.overdueCount} overdue · ${CURRENCY_FORMATTER.format(Number(summary.overdueTotal))}`,
      isUrgent: true,
    }
  }

  if (summary.unpaidCount > 0) {
    return {
      text: `${summary.unpaidCount} unpaid · ${CURRENCY_FORMATTER.format(Number(summary.unpaidTotal))}`,
      isUrgent: false,
    }
  }

  return { text: 'All paid', isUrgent: false }
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
  const { text, isUrgent } = invoiceLine(invoiceSummary)

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
          <span
            className={cn(
              'truncate text-sm',
              isUrgent ? 'font-medium text-destructive' : 'text-muted-foreground'
            )}
          >
            {text}
          </span>
        }
      />
    </div>
  )
}
