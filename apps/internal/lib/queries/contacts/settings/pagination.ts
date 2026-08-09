import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { contacts } from '@/lib/db/schema'
import {
  clampLimit,
  createSearchPattern,
  resolveDirection,
  type CursorDirection,
} from '@/lib/pagination/cursor'
import type { ContactSortField } from '@/lib/settings/contacts/filters'

import type { ContactsSettingsListItem } from './types'

export type StatusFilter = 'active' | 'archived'

export function normalizeStatus(status?: string | null): StatusFilter {
  return status === 'archived' ? 'archived' : 'active'
}

export function buildStatusCondition(status: StatusFilter): SQL {
  if (status === 'archived') {
    return sql`${contacts.deletedAt} IS NOT NULL`
  }

  return sql`${contacts.deletedAt} IS NULL`
}

export function buildSearchCondition(search: string | null | undefined): SQL | null {
  const trimmed = search?.trim()
  if (!trimmed) {
    return null
  }

  const pattern = createSearchPattern(trimmed)
  return sql`(${contacts.email} ILIKE ${pattern} OR ${contacts.name} ILIKE ${pattern})`
}

/**
 * Per-sort descriptor (PRD 004 §03, R5): order expression + cursor value
 * encoding + comparison predicates per field, mirroring
 * `USER_SORT_DESCRIPTORS`. Both fields are non-nullable so no null
 * partition applies.
 */
export type ContactSortDescriptor = {
  encode: (row: ContactsSettingsListItem) => string
  compare: (op: 'gt' | 'lt', value: string) => SQL
  equals: (value: string) => SQL
  orderAsc: SQL
  orderDesc: SQL
}

export const CONTACT_SORT_DESCRIPTORS: Record<
  ContactSortField,
  ContactSortDescriptor
> = {
  name: {
    encode: row => row.name ?? '',
    compare: (op, value) =>
      op === 'gt'
        ? sql`${contacts.name} > ${value}`
        : sql`${contacts.name} < ${value}`,
    equals: value => sql`${contacts.name} = ${value}`,
    orderAsc: sql`${contacts.name} ASC`,
    orderDesc: sql`${contacts.name} DESC`,
  },
  created: {
    encode: row => String(row.createdAt),
    compare: (op, value) =>
      op === 'gt'
        ? sql`${contacts.createdAt} > ${value}::timestamptz`
        : sql`${contacts.createdAt} < ${value}::timestamptz`,
    equals: value => sql`${contacts.createdAt} = ${value}::timestamptz`,
    orderAsc: sql`${contacts.createdAt} ASC`,
    orderDesc: sql`${contacts.createdAt} DESC`,
  },
}

export const DEFAULT_LIMITS = { defaultLimit: 20, maxLimit: 100 } as const

export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, DEFAULT_LIMITS)
}

export function resolveContactDirection(direction: CursorDirection | null | undefined) {
  return resolveDirection(direction)
}
