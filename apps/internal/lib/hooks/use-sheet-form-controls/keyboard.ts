import { useEffect } from 'react'

import { matchesShortcut } from '@/lib/keyboard/match'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'

export type KeyboardShortcutArgs = {
  isActive: boolean
  canSave: boolean
  onSave: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  flushPendingSnapshots: () => void
}

export function useHistoryKeyboardShortcuts({
  isActive,
  canSave,
  onSave,
  undo,
  redo,
  canUndo,
  canRedo,
  flushPendingSnapshots,
}: KeyboardShortcutArgs) {
  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcut(event, SHORTCUTS.save)) {
        if (!canSave) return
        event.preventDefault()
        event.stopPropagation()
        flushPendingSnapshots()
        onSave()
        return
      }

      // Undo and redo work even while an input or the editor has focus.
      if (matchesShortcut(event, SHORTCUTS.undo)) {
        if (!canUndo) return
        event.preventDefault()
        event.stopPropagation()
        flushPendingSnapshots()
        undo()
        return
      }

      if (matchesShortcut(event, SHORTCUTS.redo)) {
        if (!canRedo) return
        event.preventDefault()
        event.stopPropagation()
        flushPendingSnapshots()
        redo()
      }
    }

    // Use capture phase to intercept events before they reach inputs/editors
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      flushPendingSnapshots()
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [
    canRedo,
    canSave,
    canUndo,
    flushPendingSnapshots,
    isActive,
    onSave,
    redo,
    undo,
  ])
}
