import { useState, useCallback, useRef } from 'react'

export function useBatchSelection(threadIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastClickedRef = useRef<number>(-1)

  const toggle = useCallback((id: string, shiftKey = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const currentIndex = threadIds.indexOf(id)

      if (shiftKey && lastClickedRef.current >= 0) {
        // Range select from last clicked to current
        const start = Math.min(lastClickedRef.current, currentIndex)
        const end = Math.max(lastClickedRef.current, currentIndex)
        for (let i = start; i <= end; i++) {
          next.add(threadIds[i])
        }
      } else {
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
      }

      lastClickedRef.current = currentIndex
      return next
    })
  }, [threadIds])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(threadIds))
  }, [threadIds])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastClickedRef.current = -1
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    hasSelection: selectedIds.size > 0,
  }
}
