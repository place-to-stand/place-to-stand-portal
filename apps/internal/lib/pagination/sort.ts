/**
 * Server-side sort parsing + field-tagged keyset cursors (PRD 004 §03, R5).
 *
 * Each sortable field on a view supplies its own order expressions AND
 * cursor handling — cursors minted under one sort are invalid under
 * another. `decodeSortCursor` enforces that: a payload whose `sortField`
 * doesn't match the active sort is rejected (→ page one), the server-side
 * backstop behind `useListParams`' cursor-clearing.
 */

import { decodeCursor, encodeCursor } from './cursor'

export type SortDirection = 'asc' | 'desc'

export type ParsedSort<F extends string = string> = {
  field: F
  direction: SortDirection
}

/**
 * Parse `?sort=field:dir` against a per-view allowlist. Invalid or absent
 * values fall back to the view's default (today's hardcoded order).
 */
export function parseSortParam<F extends string>(
  raw: string | undefined,
  allowedFields: readonly F[],
  fallback: ParsedSort<F>
): ParsedSort<F> {
  if (!raw) return fallback

  const [field, direction] = raw.split(':')
  if (!(allowedFields as readonly string[]).includes(field)) {
    return fallback
  }
  if (direction !== 'asc' && direction !== 'desc') {
    return fallback
  }

  return { field: field as F, direction }
}

export function serializeSort(sort: ParsedSort): string {
  return `${sort.field}:${sort.direction}`
}

/**
 * Field-tagged cursor payload: the active sort field's value + the id
 * tie-breaker. `value: null` marks a row in the null partition of a
 * nullable sort column (NULLS LAST policy).
 */
export type SortCursorPayload = {
  sortField: string
  value: string | null
  id: string
}

export function encodeSortCursor(payload: SortCursorPayload): string {
  return encodeCursor(payload)
}

/**
 * Decode + validate: rejects legacy/foreign payload shapes and payloads
 * minted under a different sort field (stale deep-linked URLs) — callers
 * treat null as "no cursor" and serve page one (R5).
 */
export function decodeSortCursor(
  cursor: string | null | undefined,
  expectedField: string
): SortCursorPayload | null {
  const payload = decodeCursor<Partial<SortCursorPayload>>(cursor)
  if (!payload) return null
  if (payload.sortField !== expectedField) return null
  if (typeof payload.id !== 'string' || payload.id.length === 0) return null
  if (payload.value !== null && typeof payload.value !== 'string') return null

  return payload as SortCursorPayload
}
