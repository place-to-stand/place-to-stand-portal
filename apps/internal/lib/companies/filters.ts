import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

import type { CompanyListItem } from './types'

/** Companies list filters and sort (`?type=&leads=&sort=`). Client-safe. */
// Only "Clients": any other `?type=` (an old `prospect` link) means All.
export const COMPANY_TYPE_VALUES = ['client', 'former'] as const
export type CompanyTypeFilter = (typeof COMPANY_TYPE_VALUES)[number]
export const COMPANY_TYPE_LABELS: Record<CompanyTypeFilter, string> = {
  client: 'Clients',
  former: 'Former clients',
}

export const COMPANY_LEADS_VALUES = ['open', 'none'] as const
export type CompanyLeadsFilter = (typeof COMPANY_LEADS_VALUES)[number]
export const COMPANY_LEADS_LABELS: Record<CompanyLeadsFilter, string> = {
  open: 'With open leads',
  none: 'No open leads',
}

// An old `?sort=updated` falls back to the default (the column is gone).
const COMPANY_SORT_FIELDS = ['name', 'people', 'leads'] as const
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
        (type === 'client' ? Boolean(row.companyId) : row.formerClient)) &&
      (!leads || (leads === 'open') === row.openLeadCount > 0)
  )
  const value = (row: CompanyListItem): string | number => {
    switch (sort.field) {
      case 'people':
        return row.contactCount
      case 'leads':
        return row.openLeadCount
      default:
        return row.name.toLowerCase()
    }
  }
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === right) return a.name.localeCompare(b.name)
    return left < right ? -direction : direction
  })
}
