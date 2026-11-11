/**
 * In-memory column sort for lists that hold every row on the client (or
 * fetch them all on the server). Client-safe, no imports.
 *
 * A column's key is a string (compared A-Z, any case), a number or null.
 * Null means the row has no value for the column: it sorts last in both
 * directions, as the SQL lists do (NULLS LAST). Rows with equal keys keep
 * the order they arrived in, so the view's default order breaks ties.
 */
export type SortKey = string | number | boolean | null | undefined

export type SortDirection = 'asc' | 'desc'

export function compareSortKeys(left: SortKey, right: SortKey): number {
  const a = left ?? null
  const b = right ?? null
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
    .map((row, index) => ({ row, index, value: key(row) ?? null }))
    .sort((a, b) => {
      // Empty values stay last whichever way the column runs.
      if (a.value === null || b.value === null) {
        return compareSortKeys(a.value, b.value) || a.index - b.index
      }
      return factor * compareSortKeys(a.value, b.value) || a.index - b.index
    })
    .map(entry => entry.row)
}
