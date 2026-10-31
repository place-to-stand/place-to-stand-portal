import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

import type { CompanyListItem } from './types'

/** Companies list filters and sort (`?type=&leads=&sort=`). Client-safe. */
// Clients (billed now) and everyone else. Any other `?type=` (an old
// `prospect` or `former` link) means All.
export const COMPANY_TYPE_VALUES = ['client', 'none'] as const
export type CompanyTypeFilter = (typeof COMPANY_TYPE_VALUES)[number]
export const COMPANY_TYPE_LABELS: Record<CompanyTypeFilter, string> = {
  client: 'Client',
  none: 'Not a client',
}

export const COMPANY_LEADS_VALUES = ['open', 'none'] as const
export type CompanyLeadsFilter = (typeof COMPANY_LEADS_VALUES)[number]
export const COMPANY_LEADS_LABELS: Record<CompanyLeadsFilter, string> = {
  open: 'With open leads',
  none: 'No open leads',
}

// An old `?sort=updated` falls back to the default (the column is gone).
const COMPANY_SORT_FIELDS = [
  'name',
  'client',
  'hours',
  'people',
  'leads',
  'projects',
  'origination',
  'closer',
] as const
export type CompanySortField = (typeof COMPANY_SORT_FIELDS)[number]
export const DEFAULT_COMPANY_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<CompanySortField>

export const isCompanyType = (value: string): value is CompanyTypeFilter =>
  (COMPANY_TYPE_VALUES as readonly string[]).includes(value)
export const isCompanyLeads = (value: string): value is CompanyLeadsFilter =>
  (COMPANY_LEADS_VALUES as readonly string[]).includes(value)
type RawParams = Record<string, string | string[] | undefined>
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export type CompaniesListParams = {
  search: string
  type?: CompanyTypeFilter
  leads?: CompanyLeadsFilter
  sort: ParsedSort<CompanySortField>
  /** 1-based `?page=`. */
  page: number
  /** The raw `?sort=` when valid, for the column headers. */
  sortParam?: string
}

export function parseCompaniesSearchParams(
  params: RawParams
): CompaniesListParams {
  const type = first(params.type)
  const leads = first(params.leads)
  const sortParam = first(params.sort)
  const sort = parseSortParam(
    sortParam,
    COMPANY_SORT_FIELDS,
    DEFAULT_COMPANY_SORT
  )
  return {
    search: (first(params.q) ?? '').slice(0, 160),
    type: type && isCompanyType(type) ? type : undefined,
    leads: leads && isCompanyLeads(leads) ? leads : undefined,
    sort,
    page: Math.max(1, Number.parseInt(first(params.page) ?? '1', 10) || 1),
    sortParam: sort === DEFAULT_COMPANY_SORT ? undefined : sortParam,
  }
}

/** The list is unpaginated, so filters and sort run on the fetched rows. */
export function applyCompanyListParams(
  rows: CompanyListItem[],
  { type, leads, sort }: CompaniesListParams
): CompanyListItem[] {
  const filtered = rows.filter(
    row =>
      (!type ||
        (type === 'client' ? Boolean(row.companyId) : !row.companyId)) &&
      (!leads || (leads === 'open') === row.openLeadCount > 0)
  )
  // Null: no value for this column (not a client, none set, or hidden from
  // this viewer). Those rows sort last either way.
  const value = (row: CompanyListItem): string | number | null => {
    switch (sort.field) {
      case 'client':
        // Billed now first, by billing type; everyone else after.
        return !row.companyId
          ? null
          : row.billingType === 'prepaid'
            ? 0
            : row.billingType === 'net_30'
              ? 1
              : 2
      case 'hours':
        return row.hours ? row.hours.remaining : null
      case 'people':
        return row.contactCount
      case 'leads':
        return row.openLeadCount
      case 'projects':
        return row.projects.length
      case 'origination':
        return row.origination ? row.origination.name.toLowerCase() : null
      case 'closer':
        return row.closers[0] ? row.closers[0].name.toLowerCase() : null
      default:
        return row.name.toLowerCase()
    }
  }
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === null && right === null) return a.name.localeCompare(b.name)
    if (left === null) return 1
    if (right === null) return -1
    if (left === right) return a.name.localeCompare(b.name)
    return left < right ? -direction : direction
  })
}
