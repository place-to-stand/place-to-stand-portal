/**
 * In-browser search for boards (PRD 004 §03): every word of the query must
 * appear, in any order, in one of the fields, ignoring case. "under press"
 * finds "Under Pressure Screen Printing".
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
