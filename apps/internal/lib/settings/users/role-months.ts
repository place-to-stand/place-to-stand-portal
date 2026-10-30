import { addMonths, monthLabel } from '@/lib/billing/months'

export { addMonths, monthLabel } from '@/lib/billing/months'

/**
 * Which month a role change takes effect from. Role history starts in
 * October 2025 (0113); a change can start any month from then through next
 * month, except one that would rewrite a closed monthly close (the server
 * enforces this; the picker offers only the recent months). Client-safe.
 */
export const ROLE_TERMS_START = '2025-10-01'

const MONTH_START = /^\d{4}-(0[1-9]|1[0-2])-01$/

export type RoleMonthOption = {
  /** Month start, 'yyyy-MM-01'. */
  value: string
  label: string
  /** Why it can't be picked (a closed month in the way), else null. */
  disabledReason: string | null
}

export function isMonthStart(value: string): boolean {
  return MONTH_START.test(value)
}

/**
 * Why a role change can't start in `effectiveFrom`, or null when it can.
 * Starting in this month or earlier changes the role in force for every
 * month up to now, so no month in that span may be closed.
 */
export function roleMonthError(
  effectiveFrom: string,
  currentMonth: string,
  closedMonths: readonly string[]
): string | null {
  if (!isMonthStart(effectiveFrom)) return 'Choose the month the role starts.'
  if (effectiveFrom < ROLE_TERMS_START) {
    return `Role history starts in ${monthLabel(ROLE_TERMS_START)}.`
  }
  if (effectiveFrom > addMonths(currentMonth, 1)) {
    return 'A role change can start next month at the latest.'
  }
  const closed = closedMonths
    .filter(month => month >= effectiveFrom && month <= currentMonth)
    .sort()
    .at(-1)
  return closed
    ? `${monthLabel(closed)} is closed. Reopen it before changing a role back to then.`
    : null
}

/**
 * The months the "Role starts" picker offers: next month, this month, and
 * the latest earlier month that isn't closed, when a change can still start
 * then (no closed month between it and now). Older months are left out: the
 * server still rejects any month that would rewrite a closed close.
 */
export function roleMonthOptions(
  currentMonth: string,
  closedMonths: readonly string[]
): RoleMonthOption[] {
  const closed = new Set(closedMonths)
  const months = [addMonths(currentMonth, 1), currentMonth]
  for (
    let month = addMonths(currentMonth, -1);
    month >= ROLE_TERMS_START;
    month = addMonths(month, -1)
  ) {
    if (closed.has(month)) continue
    if (!roleMonthError(month, currentMonth, closedMonths)) months.push(month)
    break
  }
  return months.map(month => ({
    value: month,
    label: `${monthLabel(month)}${
      month === currentMonth
        ? ' (this month)'
        : month > currentMonth
          ? ' (next month)'
          : ''
    }`,
    disabledReason: roleMonthError(month, currentMonth, closedMonths),
  }))
}
