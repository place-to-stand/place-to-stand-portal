import { Card } from '@pts/ui/card'
import { formatCalendarDate } from '@pts/ui/dates'

import { formatHours } from '@/components/hours/hours-summary-card'
import { SummaryHeader } from '@/components/ui/summary-header'
import type { Net30MonthlyHours } from '@/lib/data/hours'

function monthLabel(month: string): string {
  return formatCalendarDate(month, { month: 'long', year: 'numeric' }) ?? ''
}

/**
 * A Net 30 client on /hours: this month's logged hours as the headline, then
 * one row per earlier month with hours, newest first. The numbers are the
 * ones the monthly close bills (see `fetchNet30MonthlyHours`).
 */
export function Net30HoursCard({
  label,
  hours,
}: {
  /** "Hours", or the client's name when there is more than one. */
  label: string
  hours: Net30MonthlyHours
}) {
  return (
    <Card className='gap-0 divide-y overflow-hidden py-0'>
      <SummaryHeader
        label={label}
        value={formatHours(hours.currentHours)}
        suffix={`logged in ${monthLabel(hours.currentMonth)}`}
      />
      {hours.earlierMonths.length > 0 ? (
        <ul aria-label='Earlier months' className='divide-y'>
          {hours.earlierMonths.map(entry => (
            <li
              key={entry.month}
              className='bg-surface-2 flex items-center justify-between gap-3 px-4 py-3 text-sm'
            >
              <span className='text-card-foreground'>
                {monthLabel(entry.month)}
              </span>
              <span className='text-muted-foreground tabular-nums'>
                {formatHours(entry.hours)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
