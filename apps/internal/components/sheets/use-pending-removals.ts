'use client'

import { useCallback, useState } from 'react'

export type PendingRemovalRow<T> = { item: T; pending: boolean }

/**
 * Remembers rows removed from a sheet list so they stay on screen as
 * "Pending removal" with Undo (`SheetRecordRow`'s `pendingRemoval`) until
 * Save, instead of vanishing. `rows` is the list to render: kept and pending
 * rows together, each where it was first shown, so removing a card or
 * undoing it never moves anything. A row put back in the list leaves the
 * pending set by itself. Undo is the list's own "add it back".
 */
export function usePendingRemovals<T>(
  keyOf: (item: T) => string,
  current: readonly T[],
  /**
   * Keys of the saved rows, for a list on the sheet's undo stack. A saved
   * row missing from the list always shows as Pending removal (also when
   * redo removes it again). A new row shows so only from its ✕ until it is
   * back on the list: an undo that takes away a row it added leaves no card.
   */
  savedKeys?: ReadonlySet<string>
) {
  const [removed, setRemoved] = useState<T[]>([])
  // Last version of each row shown, so a saved row redo removes again
  // still has a card to show.
  const [seen, setSeen] = useState<Record<string, T>>({})
  // First-seen order of every key, so a row keeps its place. New keys are
  // added during render (adjust-state-during-render, not an effect).
  const [order, setOrder] = useState<string[]>([])
  const unseen = [...current, ...removed]
    .map(keyOf)
    .filter(
      (key, index, keys) => !order.includes(key) && keys.indexOf(key) === index
    )
  const fullOrder = unseen.length ? [...order, ...unseen] : order
  if (unseen.length) setOrder(fullOrder)

  const currentKeys = new Set(current.map(keyOf))
  let pending = removed.filter(item => !currentKeys.has(keyOf(item)))
  if (savedKeys) {
    // Back on the list (undo, or Undo on the card): no longer removed.
    if (pending.length !== removed.length) setRemoved(pending)
    const latest = { ...seen }
    let changed = false
    for (const item of current) {
      const key = keyOf(item)
      // By content: a list may rebuild its rows every render.
      if (JSON.stringify(latest[key]) !== JSON.stringify(item)) {
        latest[key] = item
        changed = true
      }
    }
    if (changed) setSeen(latest)
    const pendingKeys = new Set(pending.map(keyOf))
    const savedGone = [...savedKeys]
      .filter(key => !currentKeys.has(key) && !pendingKeys.has(key))
      .flatMap(key => (latest[key] ? [latest[key]] : []))
    pending = [...pending, ...savedGone]
  }
  const position = (item: T) => fullOrder.indexOf(keyOf(item))
  const rows: PendingRemovalRow<T>[] = [
    ...current.map(item => ({ item, pending: false })),
    ...pending.map(item => ({ item, pending: true })),
  ].sort((a, b) => position(a.item) - position(b.item))

  const markRemoved = useCallback(
    (item: T) =>
      setRemoved(prev => [
        ...prev.filter(other => keyOf(other) !== keyOf(item)),
        item,
      ]),
    [keyOf]
  )

  return { rows, pending, markRemoved }
}
