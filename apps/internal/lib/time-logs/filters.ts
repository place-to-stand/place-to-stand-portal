/** Time logs page filters (`?from=&to=&client=&project=&person=&page=`). Client-safe. */
import { resolveDateRangePreset } from '@/lib/dates/calendar-date'

type RawParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

const DATE = /^\d{4}-\d{2}-\d{2}$/
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
  const from = first(params.from)
  const to = first(params.to)
  const uuid = (key: string) => {
    const value = first(params[key])
    return value && UUID.test(value) ? value : undefined
  }
  return {
    from: from && DATE.test(from) ? from : defaults.from,
    to: to && DATE.test(to) ? to : defaults.to,
    clientId: uuid('client'),
    projectId: uuid('project'),
    personId: uuid('person'),
    page: Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1),
    isDefaultRange: !(from && DATE.test(from)) && !(to && DATE.test(to)),
  }
}
