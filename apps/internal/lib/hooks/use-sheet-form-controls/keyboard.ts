import { useEffect } from 'react'

import { matchesShortcut } from '@/lib/keyboard/match'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import { announceSaveMode, type SheetSaveMode } from '@/lib/sheets/save-mode'

export type KeyboardShortcutArgs = {
  isActive: boolean
  canSave: boolean
  onSave: (mode: SheetSaveMode) => void
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
      // ⌘S saves and closes; ⇧⌘S saves and keeps the sheet open.
      const stay = matchesShortcut(event, SHORTCUTS.saveAndStay)
      if (stay || matchesShortcut(event, SHORTCUTS.save)) {
        // Claim the key even when saving is blocked, so the browser's own
        // Save (or Save As) dialog never opens over a sheet.
        event.preventDefault()
        event.stopPropagation()
        if (!canSave) return
        flushPendingSnapshots()
        const mode = stay ? 'stay' : 'close'
        announceSaveMode(mode)
        onSave(mode)
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
