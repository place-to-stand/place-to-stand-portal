/** Each column's card ids, in board order. */
export type BoardColumns = readonly (readonly string[])[]

/**
 * Shift, ⌘ or (off a Mac, where Ctrl-click is a right click) Ctrl: a card
 * click that selects instead of opening.
 */
export function hasSelectModifier(
  event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  isMac: boolean
) {
  return event.shiftKey || event.metaKey || (!isMac && event.ctrlKey)
}

/**
 * The cards from `from` to `to`, both included, when they share a column.
 * Null across columns: "everything between" has no order there, so the
 * click picks just the one card.
 */
export function boardRange(
  columns: BoardColumns,
  from: string,
  to: string
): string[] | null {
  for (const column of columns) {
    const start = column.indexOf(from)
    const end = column.indexOf(to)
    if (start === -1 || end === -1) continue
    return column.slice(Math.min(start, end), Math.max(start, end) + 1)
  }
  return null
}

/** Hides cards an archive is taking off the board. */
export function withoutHidden<T extends { id: string }>(
  items: readonly T[],
  hidden: ReadonlySet<string>
): readonly T[] {
  return hidden.size ? items.filter(item => !hidden.has(item.id)) : items
}

/**
 * The ids a bulk save didn't change, to put back on the board: the refused
 * ones, or every id when the call failed part way (it can't say which
 * changed, so the refresh shows what really happened).
 */
export function idsToPutBack(
  ids: readonly string[],
  result: { failed: { id: string }[]; error?: string }
): readonly string[] {
  if (result.error) return ids
  const refused = new Set(result.failed.map(failure => failure.id))
  return ids.filter(id => refused.has(id))
}

/**
 * What decides who can take a task: its project, or its lead for a lead's
 * task.
 */
export function taskGroup(
  task: { project_id?: string | null; lead_id?: string | null } | undefined
) {
  if (!task) return 'unknown'
  return task.project_id
    ? `project:${task.project_id}`
    : `lead:${task.lead_id ?? ''}`
}
