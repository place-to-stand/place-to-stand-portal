import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { currentBillingTypeSql } from '@/lib/queries/clients/billing-terms'
import { sql, type SQL } from 'drizzle-orm'

import { clients } from '@/lib/db/schema'
import { PAGE_SIZE_LIMITS } from '@/lib/pagination/page-size'
import {
  clampLimit,
  createSearchPattern,
} from '@/lib/pagination/cursor'
import type {
  ClientBillingFilter,
  ClientSortField,
} from '@/lib/settings/clients/filters'

export function normalizeStatus(status?: string | null) {
  return status === 'archived' ? 'archived' : 'active'
}

export type StatusFilter = 'active' | 'archived'

export function buildStatusCondition(status: StatusFilter): SQL {
  if (status === 'archived') {
    return sql`${clients.deletedAt} IS NOT NULL`
  }

  return sql`${clients.deletedAt} IS NULL`
}

export function buildBillingCondition(
  billing: ClientBillingFilter | null | undefined
): SQL | null {
  if (!billing) {
    return null
  }

  return sql`${currentBillingTypeSql()} = ${billing}`
}

export function buildSearchCondition(search: string | null | undefined): SQL | null {
  const trimmed = search?.trim()
  if (!trimmed) {
    return null
  }

  const pattern = createSearchPattern(trimmed)
  return sql`(${clientNameSql} ILIKE ${pattern} OR ${clients.slug} ILIKE ${pattern})`
}

/** Per-sort order expressions for the archive list (PRD 004 §03, R5). */
export type ClientSortDescriptor = {
  orderAsc: SQL
  orderDesc: SQL
}

export const CLIENT_SORT_DESCRIPTORS: Record<
  ClientSortField,
  ClientSortDescriptor
> = {
  name: {
    orderAsc: sql`${clientNameSql} ASC`,
    orderDesc: sql`${clientNameSql} DESC`,
  },
  created: {
    orderAsc: sql`${clients.createdAt} ASC`,
    orderDesc: sql`${clients.createdAt} DESC`,
  },
}


export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, PAGE_SIZE_LIMITS)
}
