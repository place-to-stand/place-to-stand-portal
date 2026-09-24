import { Card } from '@pts/ui/card'

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
 * One client's account: the hours balance (a read-only readout) plus a row
 * through to that client's invoices. The dashboard renders one per client
 * section, so the card never names the client itself.
 */
export function AccountCard({
  clientId,
  hoursSummary,
  invoiceSummary,
  className,
}: {
  clientId: string
  /** Absent when the client has no billing terms on record yet. */
  hoursSummary: ClientHoursSummary | undefined
  invoiceSummary: ClientInvoiceSummary
  className?: string
}) {
  return (
    <Card className={cn('gap-0 divide-y overflow-hidden py-0', className)}>
      {hoursSummary ? <HoursSummaryContent summary={hoursSummary} /> : null}

      <NavRow
        href={`/invoices?client=${clientId}`}
        title='Invoices'
        meta={
          <span className='text-muted-foreground truncate text-sm'>
            {invoiceLine(invoiceSummary)}
          </span>
        }
      />
    </Card>
  )
}
