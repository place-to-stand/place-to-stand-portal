import type { AssigneeOption } from '@/lib/assignees/types'

/** How many people the @ list shows at once. */
export const MENTION_LIST_LIMIT = 8

/**
 * The people an @query matches: anyone whose name has a word starting with
 * it ("al" finds Alex Rivera, "riv" too), names that start with it first,
 * then by name. An empty query lists everyone, by name.
 */
export function filterMentionOptions(
  options: readonly AssigneeOption[],
  query: string
): AssigneeOption[] {
  const needle = query.trim().toLowerCase()
  const scored = options.flatMap(option => {
    const name = option.name.toLowerCase()
    if (!needle) return [{ option, rank: 0 }]
    if (name.startsWith(needle)) return [{ option, rank: 0 }]
    if (name.split(/[\s.'-]+/).some(word => word.startsWith(needle))) {
      return [{ option, rank: 1 }]
    }
    return []
  })
  return scored
    .sort(
      (a, b) => a.rank - b.rank || a.option.name.localeCompare(b.option.name)
    )
    .slice(0, MENTION_LIST_LIMIT)
    .map(entry => entry.option)
}
