/**
 * In-memory column sort for lists that hold every row on the client (or
 * fetch them all on the server). Client-safe, no imports.
 *
 * A column's key is a string (compared A-Z, any case), a number or null.
 * Null, a blank string or NaN means the row has no value for the column (the
 * cell shows a dash): it sorts last in both directions, as the SQL lists do
 * (NULLS LAST). Rows with equal keys keep
 * the order they arrived in, so the view's default order breaks ties.
 */
export type SortKey = string | number | boolean | null | undefined

export type SortDirection = 'asc' | 'desc'

/** Null, undefined, a blank string and NaN are all "no value". */
function normalize(value: SortKey): string | number | boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() ? value : null
  if (typeof value === 'number' && Number.isNaN(value)) return null
  return value
}

export function compareSortKeys(left: SortKey, right: SortKey): number {
  const a = normalize(left)
  const b = normalize(right)
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? 1 : -1
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, undefined, {
      sensitivity: 'base',
      numeric: true,
    })
  }
  const x = Number(a)
  const y = Number(b)
  return x === y ? 0 : x < y ? -1 : 1
}

export function sortRows<T>(
  rows: readonly T[],
  key: (row: T) => SortKey,
  direction: SortDirection
): T[] {
  const factor = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index, value: normalize(key(row)) }))
    .sort((a, b) => {
      // Empty values stay last whichever way the column runs.
      if (a.value === null || b.value === null) {
        return compareSortKeys(a.value, b.value) || a.index - b.index
      }
      return factor * compareSortKeys(a.value, b.value) || a.index - b.index
    })
    .map(entry => entry.row)
}
