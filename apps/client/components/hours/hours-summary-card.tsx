import { Card } from '@pts/ui/card'

import { SummaryHeader } from '@/components/ui/summary-header'
import type { ClientHoursSummary } from '@/lib/data/hours'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return `${HOURS_FORMATTER.format(hours)}h`
}

type HoursSummaryProps = {
  summary: ClientHoursSummary
  /** Name the client instead of the generic label when there is more than one. */
  showClientName?: boolean
}

/**
 * The hours readout, with its own padding but no surface.
 *
 * Appears as the header row of the dashboard's account card and as a
 * standalone card on /hours.
 */
export function HoursSummaryContent({
  summary,
  showClientName = false,
}: HoursSummaryProps) {
  const label = showClientName ? summary.clientName : 'Hours'

  if (summary.kind === 'net_30') {
    return (
      <SummaryHeader
        label={label}
        value='Net 30'
        suffix='billed after work is performed'
      />
    )
  }

  const { purchased, remaining } = summary
  const isOverage = remaining < 0

  // The bar shows what's left, like the figure beside it. Guard the
  // zero-blocks case rather than dividing by it.
  const percentRemaining =
    purchased > 0
      ? Math.min(100, Math.max(0, (remaining / purchased) * 100))
      : 0

  return (
    <SummaryHeader
      label={label}
      // Overage reads as a negative figure in destructive colour; that plus the
      // full red bar is the whole signal.
      value={formatHours(remaining)}
      suffix={`remaining of ${formatHours(purchased)} total purchased`}
      percent={isOverage ? 100 : percentRemaining}
      isAlert={isOverage}
      progressLabel='Hours remaining'
    />
  )
}

/** Standalone card form, used on /hours. Not a link — hours is a readout. */
export function HoursSummaryCard(props: HoursSummaryProps) {
  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <HoursSummaryContent {...props} />
    </Card>
  )
}
