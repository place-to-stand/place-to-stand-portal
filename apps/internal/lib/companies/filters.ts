import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'
import { sortRows } from '@/lib/table/sort-rows'

import type { CompanyListItem } from './types'
import { firstParam } from '@/lib/pagination/params'
import { splitTagInput, tagKey } from '@/lib/tags/names'

/** Companies list filters and sort (`?type=&leads=&tags=&sort=`). Client-safe. */
// Clients (billed now) and everyone else. Any other `?type=` (an old
// `prospect` or `former` link) means All.
export const COMPANY_TYPE_VALUES = ['client', 'none'] as const
export type CompanyTypeFilter = (typeof COMPANY_TYPE_VALUES)[number]
export const COMPANY_TYPE_LABELS: Record<CompanyTypeFilter, string> = {
  client: 'Client',
  none: 'Not a client',
}

export const COMPANY_LEADS_VALUES = ['with', 'none'] as const
export type CompanyLeadsFilter = (typeof COMPANY_LEADS_VALUES)[number]
export const COMPANY_LEADS_LABELS: Record<CompanyLeadsFilter, string> = {
  with: 'With leads',
  none: 'No leads',
}

// An old `?sort=updated` falls back to the default (the column is gone).
const COMPANY_SORT_FIELDS = [
  'name',
  'tags',
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
export type CompaniesListParams = {
  search: string
  type?: CompanyTypeFilter
  leads?: CompanyLeadsFilter
  /** `?tags=a,b`: companies with any of these tags (names, any case). */
  tags: string[]
  sort: ParsedSort<CompanySortField>
  /** 1-based `?page=`. */
  page: number
  /** The raw `?sort=` when valid, for the column headers. */
  sortParam?: string
}

export function parseCompaniesSearchParams(
  params: RawParams
): CompaniesListParams {
  const type = firstParam(params.type)
  const leads = firstParam(params.leads)
  const sortParam = firstParam(params.sort)
  const sort = parseSortParam(
    sortParam,
    COMPANY_SORT_FIELDS,
    DEFAULT_COMPANY_SORT
  )
  return {
    search: (firstParam(params.q) ?? '').slice(0, 160),
    type: type && isCompanyType(type) ? type : undefined,
    leads: leads && isCompanyLeads(leads) ? leads : undefined,
    tags: splitTagInput(firstParam(params.tags) ?? '').slice(0, 20),
    sort,
    page: Math.max(1, Number.parseInt(firstParam(params.page) ?? '1', 10) || 1),
    sortParam: sort === DEFAULT_COMPANY_SORT ? undefined : sortParam,
  }
}

/** The list is unpaginated, so filters and sort run on the fetched rows. */
export function applyCompanyListParams(
  rows: CompanyListItem[],
  { type, leads, tags, sort }: CompaniesListParams
): CompanyListItem[] {
  const tagKeys = new Set(tags.map(tagKey))
  const filtered = rows.filter(
    row =>
      (!type ||
        (type === 'client' ? Boolean(row.companyId) : !row.companyId)) &&
      (!leads || (leads === 'with') === row.leadCount > 0) &&
      // Any of the picked tags.
      (!tagKeys.size || row.tags.some(tag => tagKeys.has(tagKey(tag))))
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
      case 'tags':
        // Tags arrive A to Z, so the list reads by its first tag.
        return row.tags.length ? row.tags.join(', ').toLowerCase() : null
      case 'hours':
        return row.hours ? row.hours.remaining : null
      // A count of 0 shows a dash: no value.
      case 'people':
        return row.contactCount || null
      case 'leads':
        return row.leadCount || null
      case 'projects':
        return row.projects.length || null
      case 'origination':
        return row.origination ? row.origination.name.toLowerCase() : null
      case 'closer':
        return row.closers[0] ? row.closers[0].name.toLowerCase() : null
      default:
        return row.name.toLowerCase()
    }
  }
  // Name A-Z breaks ties in every column.
  return sortRows(
    sortRows(filtered, row => row.name, 'asc'),
    value,
    sort.direction
  )
}
