import { parseCalendarDate } from '@/lib/dates/calendar-date'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'
import { UUID_PATTERN } from '@/lib/sheets/entities'

// PRD 004 §03: per-view sort allowlist (D6/R5). The single field has a
// matching descriptor (order expr + cursor encode/compare) in the query.
const HOUR_BLOCK_SORT_FIELDS = ['created'] as const
export type HourBlockSortField = (typeof HOUR_BLOCK_SORT_FIELDS)[number]

export const DEFAULT_HOUR_BLOCKS_SORT = {
  field: 'created',
  direction: 'desc',
} as const satisfies ParsedSort<HourBlockSortField>

export function isHourBlockSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (HOUR_BLOCK_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

/**
 * Invoice filter (`?invoice=`): the invoice the block came from.
 * `none` is a block added by hand; `unpaid` is sent or viewed, not paid.
 */
export const HOUR_BLOCK_INVOICE_VALUES = [
  'none',
  'draft',
  'unpaid',
  'paid',
] as const
export type HourBlockInvoiceFilter = (typeof HOUR_BLOCK_INVOICE_VALUES)[number]
export const HOUR_BLOCK_INVOICE_LABELS: Record<HourBlockInvoiceFilter, string> =
  {
    none: 'No invoice',
    draft: 'Draft invoice',
    unpaid: 'Sent, unpaid',
    paid: 'Paid',
  }
export function isHourBlockInvoiceFilter(
  value: string | undefined
): value is HourBlockInvoiceFilter {
  return (
    HOUR_BLOCK_INVOICE_VALUES as readonly (string | undefined)[]
  ).includes(value)
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type HourBlocksSearchParams = {
  page: number
  search: string | undefined
  sort: ParsedSort<HourBlockSortField>
  /** Only this client's blocks (`?companyId=`). */
  companyId: string | undefined
  invoice: HourBlockInvoiceFilter | undefined
  /** Created between (`?from=&to=`, `YYYY-MM-DD`); none is All time. */
  from: string | undefined
  to: string | undefined
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  return undefined
}

/** Shared searchParams parsing for the hour-blocks pages (offset paged). */
export function parseHourBlocksSearchParams(
  params: RawSearchParams
): HourBlocksSearchParams {
  const page = Math.max(
    1,
    Number.parseInt(firstParam(params.page) ?? '1', 10) || 1
  )
  const searchParam = firstParam(params.q)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    HOUR_BLOCK_SORT_FIELDS,
    DEFAULT_HOUR_BLOCKS_SORT
  )

  const companyId = firstParam(params.companyId)
  const invoice = firstParam(params.invoice)
  const date = (key: string) => {
    const value = firstParam(params[key])
    return value && parseCalendarDate(value) ? value : undefined
  }

  return {
    page,
    search: searchParam || undefined,
    sort,
    companyId:
      companyId && UUID_PATTERN.test(companyId) ? companyId : undefined,
    invoice: isHourBlockInvoiceFilter(invoice) ? invoice : undefined,
    from: date('from'),
    to: date('to'),
  }
}
