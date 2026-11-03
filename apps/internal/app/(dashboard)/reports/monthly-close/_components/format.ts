import { formatCalendarDate } from '@pts/ui/dates'
import { formatCurrency, formatPercent } from '@pts/ui/numbers'

/** A deduction line: "−$14,572.50" (true minus sign). */
export function formatDeduction(amount: number): string {
  return `−${formatCurrency(Math.abs(amount))}`
}

/** `part` as a whole-number share of `whole`: "42%"; "0%" when there's no whole. */
export function formatShare(part: number, whole: number): string {
  return formatPercent(whole > 0 ? part / whole : 0, { maxDecimals: 0 })
}

/** "2026-08-31" → "Aug 31". */
export function formatShortDay(isoDate: string): string {
  return (
    formatCalendarDate(isoDate, { month: 'short', day: 'numeric' }) ?? isoDate
  )
}

/** "2026-08-31" → "Aug 31, 2026". */
export function formatDay(value: string): string {
  return formatCalendarDate(value) ?? value
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function userAvatarSrc(
  userId: string,
  avatarUpdatedAt: string | null
): string | null {
  return avatarUpdatedAt
    ? `/api/storage/user-avatar/${userId}?v=${encodeURIComponent(avatarUpdatedAt)}`
    : null
}
