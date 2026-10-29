/**
 * Time logs page filters (`?from=&to=&clientId=&projectId=&personId=&page=`).
 * Not `client`/`project`: those params open the client and project sheets.
 * Client-safe.
 */
import {
  parseCalendarDate,
  resolveDateRangePreset,
} from '@/lib/dates/calendar-date'

type RawParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TimeLogsListParams = {
  from: string
  to: string
  clientId?: string
  projectId?: string
  personId?: string
  page: number
  /** True when the dates are the default (this month), not chosen. */
  isDefaultRange: boolean
}

/** First and last day of the current month, `YYYY-MM-DD`. */
export function currentMonthRange(now = new Date()) {
  return resolveDateRangePreset('this-month', now)
}

export function parseTimeLogsSearchParams(params: RawParams): TimeLogsListParams {
  const defaults = currentMonthRange()
  // A real calendar date (2026-02-31 is not), or the default.
  const valid = (value: string | undefined) =>
    value && parseCalendarDate(value) ? value : undefined
  const from = valid(first(params.from))
  const to = valid(first(params.to))
  const uuid = (key: string) => {
    const value = first(params[key])
    return value && UUID.test(value) ? value : undefined
  }
  return {
    from: from ?? defaults.from,
    to: to ?? defaults.to,
    clientId: uuid('clientId'),
    projectId: uuid('projectId'),
    personId: uuid('personId'),
    page: Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1),
    isDefaultRange: !from && !to,
  }
}
