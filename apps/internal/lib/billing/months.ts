import { formatCalendarDate } from '@pts/ui/dates'

/**
 * Month starts ('yyyy-MM-01') and their labels, the way the server counts
 * them: in UTC, so a select and the save it feeds agree on "this month".
 * Client-safe: billing, commission and role months all use these.
 */

/** First day of the current month in UTC, as 'yyyy-MM-01'. */
export function currentMonthStartUtc(): string {
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}-${month}-01`
}

/** 'yyyy-MM-01' plus `offset` months (negative goes back). */
export function addMonths(monthStart: string, offset: number): string {
  const [year, month] = monthStart.split('-').map(Number)
  // Date handles month overflow (December -> January next year).
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** First day of next month in UTC, as 'yyyy-MM-01'. */
export function nextMonthStartUtc(): string {
  return addMonths(currentMonthStartUtc(), 1)
}

/** "October 2026" for a month start. */
export function monthLabel(monthStart: string): string {
  return (
    formatCalendarDate(monthStart, { month: 'long', year: 'numeric' }) ?? ''
  )
}

/** "October 2026" for this month (0), next (1) or last (-1). */
export function monthLabelFromNow(offset: number): string {
  return monthLabel(addMonths(currentMonthStartUtc(), offset))
}

/** "October 2026 (this month)", then "November 2026 (next month)". */
export function thisOrNextMonthOptions(): {
  value: 'current_month' | 'next_month'
  label: string
}[] {
  return [
    { value: 'current_month', label: `${monthLabelFromNow(0)} (this month)` },
    { value: 'next_month', label: `${monthLabelFromNow(1)} (next month)` },
  ]
}
