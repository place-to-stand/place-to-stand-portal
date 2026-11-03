import { formatCalendarDate } from '@pts/ui/dates'

/** `long` → "September 3, 2026"; `short` → "Sep 3, 2026" (the paid stamp). */
export const formatDate = (
  dateStr: string | null,
  style: 'long' | 'short' = 'long'
) =>
  formatCalendarDate(dateStr, { year: 'numeric', month: style, day: 'numeric' })
