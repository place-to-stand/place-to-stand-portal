import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ClientHoursSummary } from '@/lib/data/hours'

const HOURS_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

function formatHours(hours: number): string {
  return `${HOURS_FORMATTER.format(hours)}h`
}

type HoursSummaryCardProps = {
  summary: ClientHoursSummary
  /** Only label the card when the viewer has more than one client. */
  showClientName?: boolean
  /** When set, the whole card becomes a link. */
  href?: string
}

export function HoursSummaryCard({
  summary,
  showClientName = false,
  href,
}: HoursSummaryCardProps) {
  const body =
    summary.kind === 'net_30' ? (
      <NetThirtyBody />
    ) : (
      <PrepaidBody summary={summary} />
    )

  const card = (
    <Card className={cn('gap-0 py-5', href && 'transition-colors hover:bg-muted/50')}>
      <CardContent className="px-5">
        {showClientName && (
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {summary.clientName}
          </p>
        )}
        {body}
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  )
}

function NetThirtyBody() {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">Hours</p>
      <p className="mt-1 text-sm text-muted-foreground">
        You are billed on Net 30 terms.
      </p>
    </div>
  )
}

function PrepaidBody({
  summary,
}: {
  summary: Extract<ClientHoursSummary, { kind: 'prepaid' }>
}) {
  const { purchased, used, remaining } = summary
  const isOverage = remaining < 0

  // Guard the zero-blocks case rather than dividing by it.
  const percentUsed =
    purchased > 0 ? Math.min(100, Math.max(0, (used / purchased) * 100)) : 0

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">
        Hours Remaining
      </p>

      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            'text-3xl font-bold tabular-nums',
            isOverage ? 'text-destructive' : 'text-foreground'
          )}
        >
          {formatHours(remaining)}
        </span>
        <span className="text-sm text-muted-foreground">
          of {formatHours(purchased)} purchased
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(isOverage ? 100 : percentUsed)}
        aria-label="Hours used"
      >
        <div
          className={cn(
            'h-full rounded-full',
            isOverage ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${isOverage ? 100 : percentUsed}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {formatHours(used)} used
        {isOverage && (
          <span className="text-destructive">
            {' '}
            &middot; {formatHours(Math.abs(remaining))} over
          </span>
        )}
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Hours {summary.clientName} has purchased. This is connected to our
        internal task tracking systems.
      </p>
    </div>
  )
}
