import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { contacts } from '@/lib/db/schema'
import {
  clampLimit,
  createSearchPattern,
  decodeCursor,
  encodeCursor,
  resolveDirection,
  type CursorDirection,
} from '@/lib/pagination/cursor'

export type ContactCursorPayload = { email?: string; id?: string }

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

export function buildContactCursorCondition(
  direction: CursorDirection,
  cursor: ContactCursorPayload | null
) {
  if (!cursor) {
    return null
  }

  const emailValue =
    typeof cursor.email === 'string' ? cursor.email : (cursor.email ?? '')
  const idValue = typeof cursor.id === 'string' ? cursor.id : ''

  if (!idValue) {
    return null
  }

  const normalizedEmail = sql`coalesce(${contacts.email}, '')`

  if (direction === 'forward') {
    return sql`${normalizedEmail} > ${emailValue} OR (${normalizedEmail} = ${emailValue} AND ${contacts.id} > ${idValue})`
  }

  return sql`${normalizedEmail} < ${emailValue} OR (${normalizedEmail} = ${emailValue} AND ${contacts.id} < ${idValue})`
}

export const DEFAULT_LIMITS = { defaultLimit: 20, maxLimit: 100 } as const

export function resolvePaginationLimit(limit: number | null | undefined) {
  return clampLimit(limit, DEFAULT_LIMITS)
}

export function decodeContactCursor(cursor: string | null | undefined) {
  return decodeCursor<ContactCursorPayload>(cursor)
}

export function encodeContactCursor(payload: ContactCursorPayload | null) {
  if (!payload) return null
  return encodeCursor({
    email: payload.email ?? '',
    id: payload.id ?? '',
  })
}

export function resolveContactDirection(direction: CursorDirection | null | undefined) {
  return resolveDirection(direction)
}
