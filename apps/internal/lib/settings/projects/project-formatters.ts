import { formatCalendarDate } from '@pts/ui/dates'

/**
 * Normalizes a date string and formats it for display. Returns null when the
 * input is missing or cannot be parsed.
 */
function formatProjectDate(value?: string | null): string | null {
  if (!value) {
    return null
  }

  // Date-only values render as the stored calendar day in every timezone.
  return formatCalendarDate(value)
}

/**
 * Produces a human-readable date range for a project, gracefully handling
 * missing bounds and identical start/end days.
 */
export function formatProjectDateRange(
  start?: string | null,
  end?: string | null
): string {
  if (!start && !end) {
    return '—'
  }

  const startLabel = formatProjectDate(start) ?? 'TBD'
  const endLabel = formatProjectDate(end) ?? 'TBD'

  if (startLabel === endLabel) {
    return startLabel
  }

  return `${startLabel} – ${endLabel}`
}
