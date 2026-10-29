import {
  addDays,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns'

/**
 * Calendar dates (`YYYY-MM-DD`) as the date pickers read and write them.
 *
 * A calendar date is a day on the wall calendar, not an instant: it is parsed
 * to local midnight and formatted back from local fields, so no timezone
 * conversion can shift it by a day. Display formatting stays with
 * `formatCalendarDate` (`@pts/ui/dates`).
 */

export type CalendarDate = string

export type CalendarDateRange = { from: CalendarDate; to: CalendarDate }

/**
 * First day of the week for every picker and week preset. Sunday, matching
 * the project calendar (`lib/projects/calendar/calendar-helpers.ts`).
 */
export const WEEK_STARTS_ON = 0 as const

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CALENDAR_DATE_FORMAT = 'yyyy-MM-dd'

export function isCalendarDate(value: unknown): value is CalendarDate {
  return typeof value === 'string' && CALENDAR_DATE_RE.test(value)
}

/** `Date` (local fields) → `YYYY-MM-DD`. */
export function toCalendarDate(date: Date): CalendarDate {
  return format(date, CALENDAR_DATE_FORMAT)
}

/** `YYYY-MM-DD` → local-midnight `Date`; undefined for anything else. */
export function parseCalendarDate(
  value: string | null | undefined
): Date | undefined {
  if (!isCalendarDate(value)) return undefined
  const parsed = parse(value, CALENDAR_DATE_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

/** Today's calendar date in the viewer's timezone. */
export function todayCalendarDate(now: Date = new Date()): CalendarDate {
  return toCalendarDate(now)
}

export type DateRangePresetKey =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'last-30-days'
  | 'this-quarter'
  | 'last-quarter'
  | 'year-to-date'
  | 'last-year'

type Bounds = [Date, Date]

const week = { weekStartsOn: WEEK_STARTS_ON }

const PRESET_BOUNDS: Record<DateRangePresetKey, (now: Date) => Bounds> = {
  today: now => [now, now],
  yesterday: now => [addDays(now, -1), addDays(now, -1)],
  'this-week': now => [startOfWeek(now, week), endOfWeek(now, week)],
  'last-week': now => {
    const prior = subWeeks(now, 1)
    return [startOfWeek(prior, week), endOfWeek(prior, week)]
  },
  'this-month': now => [startOfMonth(now), endOfMonth(now)],
  'last-month': now => {
    const prior = subMonths(now, 1)
    return [startOfMonth(prior), endOfMonth(prior)]
  },
  'last-30-days': now => [addDays(now, -29), now],
  'this-quarter': now => [startOfQuarter(now), endOfQuarter(now)],
  'last-quarter': now => {
    const prior = subQuarters(now, 1)
    return [startOfQuarter(prior), endOfQuarter(prior)]
  },
  'year-to-date': now => [startOfYear(now), now],
  'last-year': now => {
    const prior = subYears(now, 1)
    return [startOfYear(prior), endOfYear(prior)]
  },
}

/** Picker order. */
export const DATE_RANGE_PRESETS: ReadonlyArray<{
  key: DateRangePresetKey
  label: string
}> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this-week', label: 'This week' },
  { key: 'last-week', label: 'Last week' },
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'last-30-days', label: 'Last 30 days' },
  { key: 'this-quarter', label: 'This quarter' },
  { key: 'last-quarter', label: 'Last quarter' },
  { key: 'year-to-date', label: 'Year to date' },
  { key: 'last-year', label: 'Last year' },
]

/** A preset's inclusive range, as of `now`. */
export function resolveDateRangePreset(
  key: DateRangePresetKey,
  now: Date = new Date()
): CalendarDateRange {
  const [from, to] = PRESET_BOUNDS[key](now)
  return { from: toCalendarDate(from), to: toCalendarDate(to) }
}

/** The preset a range equals today, if any (first match wins). */
export function matchDateRangePreset(
  range: CalendarDateRange,
  now: Date = new Date()
): DateRangePresetKey | null {
  for (const preset of DATE_RANGE_PRESETS) {
    const resolved = resolveDateRangePreset(preset.key, now)
    if (resolved.from === range.from && resolved.to === range.to) {
      return preset.key
    }
  }
  return null
}
