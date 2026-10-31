'use client'

import { useCallback, useState } from 'react'

/**
 * Remembers rows removed from a sheet list so they stay on screen as
 * "Pending removal" with Undo (`SheetRecordRow`'s `pendingRemoval`) until
 * Save, instead of vanishing. A row put back in the list leaves the pending
 * set by itself. Undo is the list's own "add it back".
 */
export function usePendingRemovals<T>(
  keyOf: (item: T) => string,
  currentKeys: readonly string[]
) {
  const [removed, setRemoved] = useState<T[]>([])
  const current = new Set(currentKeys)
  const pending = removed.filter(item => !current.has(keyOf(item)))

  const markRemoved = useCallback(
    (item: T) =>
      setRemoved(prev => [
        ...prev.filter(other => keyOf(other) !== keyOf(item)),
        item,
      ]),
    [keyOf]
  )

  return { pending, markRemoved }
}
