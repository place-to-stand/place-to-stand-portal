/**
 * Timezone-stable date formatting.
 *
 * Server components render in UTC on Vercel while browsers hydrate in the
 * user's local timezone, so any ambient-timezone formatting produces
 * hydration text mismatches (React #418) plus off-by-one calendar dates for
 * date-only columns. These helpers render identical strings in every runtime:
 * date-only strings ("2026-08-05") are formatted without timezone conversion,
 * and timestamps are pinned to the company timezone.
 */

export const COMPANY_TIME_ZONE = 'America/Los_Angeles'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

type CalendarDateStyle = Pick<
  Intl.DateTimeFormatOptions,
  'year' | 'month' | 'day' | 'weekday' | 'hour' | 'minute'
>

const DEFAULT_STYLE: CalendarDateStyle = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (style: CalendarDateStyle, timeZone: string) => {
  const key = `${timeZone}|${JSON.stringify(style)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { ...style, timeZone })
    formatterCache.set(key, formatter)
  }
  return formatter
}

/**
 * Format a date column value or timestamp into a calendar-date string that is
 * identical on the server and in every client timezone.
 *
 * Date-only strings are formatted via UTC so the stored calendar date is read
 * back verbatim; timestamps are formatted in {@link COMPANY_TIME_ZONE}.
 */
export function formatCalendarDate(
  value: string | Date | null | undefined,
  style: CalendarDateStyle = DEFAULT_STYLE
): string | null {
  if (!value) return null
  if (typeof value === 'string' && DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return getFormatter(style, 'UTC').format(new Date(Date.UTC(year, month - 1, day)))
  }
  const parsed = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(parsed.getTime())) return null
  return getFormatter(style, COMPANY_TIME_ZONE).format(parsed)
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat('en-US', {
  numeric: 'auto',
})

/**
 * "3 days ago", "yesterday", "in 2 hours", "just now". The one sanctioned way
 * to show relative time. The text depends on `now`, so render it in a client
 * component (or pass a fixed `now`) to keep server and client output equal.
 */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  if (!value) return null
  const parsed = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(parsed.getTime())) return null

  const seconds = Math.round((parsed.getTime() - now.getTime()) / 1000)
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return relativeFormatter.format(Math.round(seconds / unitSeconds), unit)
    }
  }
  return 'just now'
}

/**
 * Today's calendar date in {@link COMPANY_TIME_ZONE} as `YYYY-MM-DD`, the
 * date column format (not for display: show it with formatCalendarDate).
 */
export function companyCalendarDate(now: Date = new Date()): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPANY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * UTC offset (ms) of `timeZone` at the given instant: local wall time minus
 * UTC. Negative for America/Los_Angeles.
 */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) =>
    Number(parts.find(part => part.type === type)?.value ?? 0)
  const wallAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  )
  return wallAsUtc - utcMs
}

/**
 * The instant a month ends in {@link COMPANY_TIME_ZONE}: midnight on the
 * first of the next month (so Aug 31 ends at Sep 1 07:00Z). `month` is
 * 1-indexed. Two passes settle the offset across a DST change.
 */
export function companyMonthEndCutoff(year: number, month: number): Date {
  const naive = Date.UTC(year, month, 1) // month is 1-indexed → next month
  let utc = naive - zoneOffsetMs(naive, COMPANY_TIME_ZONE)
  utc = naive - zoneOffsetMs(utc, COMPANY_TIME_ZONE)
  return new Date(utc)
}
