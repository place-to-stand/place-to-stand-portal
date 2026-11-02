import 'server-only'

import { companyCalendarDate } from '@pts/ui/dates'

import { fetchLastSentPeriodEnd } from './queries'

export type UpdateWindow = {
  periodStart: string
  periodEnd: string
}

const DEFAULT_LOOKBACK_DAYS = 7

/** Today's calendar date in the company timezone as YYYY-MM-DD. */
export function todayCalendarDate(): string {
  return companyCalendarDate()
}

function shiftCalendarDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Where the report should start. An explicit `since` wins; otherwise pick up
 * the day after the last sent update so consecutive reports tile without a
 * gap or an overlap; otherwise fall back to a week.
 */
export async function resolveUpdateWindow(
  companyId: string,
  since?: string | null
): Promise<UpdateWindow> {
  const periodEnd = todayCalendarDate()

  if (since) return { periodStart: since, periodEnd }

  const lastPeriodEnd = await fetchLastSentPeriodEnd(companyId)
  if (lastPeriodEnd) {
    // A second update on the same day would otherwise start tomorrow and end
    // today; clamp to a one-day window instead.
    const next = shiftCalendarDate(lastPeriodEnd, 1)
    return { periodStart: next > periodEnd ? periodEnd : next, periodEnd }
  }

  return {
    periodStart: shiftCalendarDate(periodEnd, -DEFAULT_LOOKBACK_DAYS),
    periodEnd,
  }
}
