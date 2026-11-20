/**
 * In-browser search for boards: every word of the query must appear in some
 * field, in any order, ignoring case. "under press" finds "Under Pressure
 * Screen Printing".
 */
export function matchesSearch(
  fields: ReadonlyArray<string | null | undefined>,
  query: string | null | undefined
): boolean {
  const words = (query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .join('\n')
    .toLowerCase()
  return words.every(word => haystack.includes(word))
}
