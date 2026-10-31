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
  current: readonly T[]
) {
  const [removed, setRemoved] = useState<T[]>([])
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
  const pending = removed.filter(item => !currentKeys.has(keyOf(item)))
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
