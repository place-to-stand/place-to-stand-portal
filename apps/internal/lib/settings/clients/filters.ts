import { clientBillingType } from '@/lib/db/schema'
import { parseSortParam, type ParsedSort } from '@/lib/pagination/sort'

export const CLIENT_BILLING_VALUES = clientBillingType.enumValues

export type ClientBillingFilter = (typeof CLIENT_BILLING_VALUES)[number]

export const CLIENT_BILLING_LABELS: Record<ClientBillingFilter, string> = {
  prepaid: 'Prepaid',
  net_30: 'Net 30',
}

export function isClientBilling(
  value: string | undefined
): value is ClientBillingFilter {
  return (
    typeof value === 'string' &&
    (CLIENT_BILLING_VALUES as readonly string[]).includes(value)
  )
}

// PRD 004 §03: per-view sort allowlist (D6/R5). Each field here has a
// matching descriptor (order expr + cursor encode/compare) in the query.
export const CLIENT_SORT_FIELDS = ['name', 'created'] as const
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number]

export const DEFAULT_CLIENTS_SORT = {
  field: 'name',
  direction: 'asc',
} as const satisfies ParsedSort<ClientSortField>

export function isClientSortValue(value: string): boolean {
  const [field, direction] = value.split(':')
  return (
    (CLIENT_SORT_FIELDS as readonly string[]).includes(field) &&
    (direction === 'asc' || direction === 'desc')
  )
}

type RawSearchParams = Record<string, string | string[] | undefined>

export type ClientsSearchParams = {
  cursor: string | null
  direction: 'forward' | 'backward'
  limit: number | undefined
  billing: ClientBillingFilter | undefined
  search: string | undefined
  sort: ParsedSort<ClientSortField>
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

/**
 * Shared searchParams parsing for the clients pages (landing + archive),
 * mirroring `parseUsersSearchParams`. Invalid sort values fall back to the
 * view default via the allowlist.
 */
export function parseClientsSearchParams(
  params: RawSearchParams
): ClientsSearchParams {
  const cursor = firstParam(params.cursor) ?? null
  const direction =
    firstParam(params.dir) === 'backward' ? 'backward' : ('forward' as const)
  const limitParam = Number.parseInt(firstParam(params.limit) ?? '', 10)
  const billingParam = firstParam(params.billing)
  const searchParam = firstParam(params.q)?.trim()
  const sort = parseSortParam(
    firstParam(params.sort),
    CLIENT_SORT_FIELDS,
    DEFAULT_CLIENTS_SORT
  )

  return {
    cursor,
    direction,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
    billing: isClientBilling(billingParam) ? billingParam : undefined,
    search: searchParam || undefined,
    sort,
  }
}
