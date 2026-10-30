import { addMonths, monthLabel } from '@/lib/billing/months'

export { addMonths, monthLabel } from '@/lib/billing/months'

/**
 * Which month a role change takes effect from. Role history starts in
 * October 2025 (0113); a change can start any month from then through next
 * month, except one that would rewrite a closed monthly close. Client-safe.
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

/** Next month first, then this month, back to October 2025. */
export function roleMonthOptions(
  currentMonth: string,
  closedMonths: readonly string[]
): RoleMonthOption[] {
  const options: RoleMonthOption[] = []
  for (
    let month = addMonths(currentMonth, 1);
    month >= ROLE_TERMS_START;
    month = addMonths(month, -1)
  ) {
    const suffix =
      month === currentMonth
        ? ' (this month)'
        : month > currentMonth
          ? ' (next month)'
          : ''
    options.push({
      value: month,
      label: `${monthLabel(month)}${suffix}`,
      disabledReason: roleMonthError(month, currentMonth, closedMonths),
    })
  }
  return options
}
