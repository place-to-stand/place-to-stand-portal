/**
 * Time logs page filters (`?from=&to=&companyId=&projectId=&personId=&page=`;
 * `from=all` is All time, no date bounds).
 * Not `client`/`project`: those params open the client and project sheets.
 * Client-safe.
 */
import {
  parseCalendarDate,
  resolveDateRangePreset,
} from '@/lib/dates/calendar-date'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

export const TIME_LOG_SORT_FIELDS = [
  'date',
  'hours',
  'person',
  'client',
  'project',
] as const
export type TimeLogSortField = (typeof TIME_LOG_SORT_FIELDS)[number]
/** Newest first. */
export const DEFAULT_TIME_LOG_SORT = {
  field: 'date',
  direction: 'desc',
} as const satisfies ParsedSort<TimeLogSortField>

type RawParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TimeLogsListParams = {
  from: string
  to: string
  companyId?: string
  projectId?: string
  personId?: string
  page: number
  sort: ParsedSort<TimeLogSortField>
  /** The raw `?sort=` when valid and not the default, for the headers. */
  sortParam?: string
  /** True when the dates are the default (this month), not chosen. */
  isDefaultRange: boolean
}

/** `?from=all`: the All time preset, no date bounds. */
export const ALL_TIME_PARAM = 'all'

/** First and last day of the current month, `YYYY-MM-DD`. */
export function currentMonthRange(now = new Date()) {
  return resolveDateRangePreset('this-month', now)
}

export function parseTimeLogsSearchParams(
  params: RawParams
): TimeLogsListParams {
  const defaults = currentMonthRange()
  // A real calendar date (2026-02-31 is not), or the default.
  const valid = (value: string | undefined) =>
    value && parseCalendarDate(value) ? value : undefined
  const allTime = first(params.from) === ALL_TIME_PARAM
  const from = allTime ? '' : valid(first(params.from))
  const to = allTime ? '' : valid(first(params.to))
  const uuid = (key: string) => {
    const value = first(params[key])
    return value && UUID.test(value) ? value : undefined
  }
  return {
    from: from ?? defaults.from,
    to: to ?? defaults.to,
    companyId: uuid('companyId'),
    projectId: uuid('projectId'),
    personId: uuid('personId'),
    page: Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1),
    ...parseSort(first(params.sort)),
    isDefaultRange: !allTime && !from && !to,
  }
}

function parseSort(raw: string | undefined) {
  const sort = parseSortParam(raw, TIME_LOG_SORT_FIELDS, DEFAULT_TIME_LOG_SORT)
  return { sort, sortParam: sort === DEFAULT_TIME_LOG_SORT ? undefined : raw }
}
