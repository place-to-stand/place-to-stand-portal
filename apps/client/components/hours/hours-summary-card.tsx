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
  const label = showClientName ? summary.clientName : 'Hours Remaining'

  if (summary.kind === 'net_30') {
    return (
      <SummaryHeader
        label={label}
        value="Net 30"
        suffix="billed after work is performed"
      />
    )
  }

  const { purchased, used, remaining } = summary
  const isOverage = remaining < 0

  // Guard the zero-blocks case rather than dividing by it.
  const percentUsed =
    purchased > 0 ? Math.min(100, Math.max(0, (used / purchased) * 100)) : 0

  return (
    <SummaryHeader
      label={label}
      // Overage reads as a negative figure in destructive colour; that plus the
      // full red bar is the whole signal.
      value={formatHours(remaining)}
      suffix={`of ${formatHours(purchased)} purchased`}
      percent={isOverage ? 100 : percentUsed}
      isAlert={isOverage}
      progressLabel="Hours used"
    />
  )
}

/** Standalone card form, used on /hours. Not a link — hours is a readout. */
export function HoursSummaryCard(props: HoursSummaryProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <HoursSummaryContent {...props} />
    </div>
  )
}
