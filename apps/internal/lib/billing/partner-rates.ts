import 'server-only'

/**
 * Partners Payment Formula rate schedule.
 *
 * Every billable hour at $200/hr is split four ways:
 *   - Payroll (paid to the admin who performed the work)
 *   - Closer (internal PTS partner who finalized the deal)
 *   - Origination (internal sourcing partner OR external referrer)
 *   - House (firm overhead)
 *
 * Rates are period-scoped (forward-only) so historical monthly close reports
 * render using the rates that were in effect at the time. The schedule is
 * stored in code (not the DB) because rates change through engineering, there
 * is no runtime mutation, and all consumers are server-side.
 *
 * Boundary note: a month's rates are selected by the period's START date.
 * An hour_block created at 2026-03-31T23:59:00Z falls in March and renders at
 * pre-cutover rates. A time log on 2026-04-01 falls in April and renders at
 * the new rates.
 */

export type PartnerRateSchedule = {
  /** ISO date (YYYY-MM-DD). Inclusive lower bound of the rate's validity. */
  effectiveFrom: string
  /** Total billable rate charged to clients. */
  billablePerHour: number
  /** Paid to the admin who logged the time (45% of $200 post-cutover). */
  payrollPerHour: number
  /** Paid to the internal partner who finalized the deal (20% post-cutover). */
  closerPerHour: number
  /** Paid to the finder — internal sourcing partner or external referrer (10%). */
  originationPerHour: number
  /**
   * Whether internal-user originators are paid out this period. Pre-April 2026
   * the firm only paid external referrers; internal sourcing was rolled into
   * house. When false, internal-user origination rows are dropped from the
   * payout pipeline and naturally absorbed by the residual house.
   */
  internalOriginationPayable: boolean
  /** Retained by the firm for overhead (25% post-cutover). */
  housePerHour: number
}

/**
 * Sorted NEWEST-FIRST. getPartnerRatesForPeriod returns the first entry whose
 * effectiveFrom is <= the requested period start date.
 */
const RATE_SCHEDULE: readonly PartnerRateSchedule[] = [
  {
    effectiveFrom: '2026-04-01',
    billablePerHour: 200,
    payrollPerHour: 90,
    closerPerHour: 40,
    originationPerHour: 20,
    internalOriginationPayable: true,
    housePerHour: 50,
  },
  {
    effectiveFrom: '2025-10-01',
    billablePerHour: 200,
    payrollPerHour: 100,
    closerPerHour: 0,
    originationPerHour: 20,
    internalOriginationPayable: false,
    housePerHour: 80,
  },
] as const

// Runtime invariant: each entry's splits must sum to its billable rate.
// This catches drift if someone edits a single field without updating the
// others.
for (const entry of RATE_SCHEDULE) {
  const sum =
    entry.payrollPerHour +
    entry.closerPerHour +
    entry.originationPerHour +
    entry.housePerHour
  if (sum !== entry.billablePerHour) {
    throw new Error(
      `partner-rates: schedule entry ${entry.effectiveFrom} splits sum to ${sum}, expected ${entry.billablePerHour}`
    )
  }
}

/**
 * Returns the partner rate schedule in effect on the given date.
 *
 * @param periodStartDate ISO date string (YYYY-MM-DD). Typically the first
 *   day of the reporting month.
 */
export function getPartnerRatesForPeriod(
  periodStartDate: string
): PartnerRateSchedule {
  const entry = RATE_SCHEDULE.find(
    rate => rate.effectiveFrom <= periodStartDate
  )
  if (!entry) {
    throw new Error(
      `partner-rates: no schedule entry covers ${periodStartDate}`
    )
  }
  return entry
}

/**
 * Returns the most recent (current) rate schedule — the first entry in the
 * newest-first sorted array. Useful for detecting when a historical month
 * uses an older formula.
 */
export function getLatestPartnerRates(): PartnerRateSchedule {
  return RATE_SCHEDULE[0]
}
