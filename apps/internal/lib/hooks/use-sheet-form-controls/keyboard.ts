import { useEffect } from 'react'

import type { SheetSaveMode } from '@/lib/sheets/save-mode'

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
      if (!event.key) return
      const key = event.key.toLowerCase()
      const hasMeta = event.metaKey
      const hasCtrl = event.ctrlKey
      const modifierActive = hasMeta || hasCtrl

      if (!modifierActive) {
        return
      }

      // ⌘S saves and closes; ⇧⌘S saves and keeps the sheet open.
      if (key === 's') {
        // Claim the key even when saving is blocked, so the browser's own
        // Save (or Save As) dialog never opens over a sheet.
        event.preventDefault()
        event.stopPropagation()
        if (!canSave) {
          return
        }

        flushPendingSnapshots()
        onSave(event.shiftKey ? 'stay' : 'close')
        return
      }

      // Handle undo/redo shortcuts
      // These should work even when inputs/editors are focused
      if (key === 'z') {
        if (event.shiftKey) {
          // Shift+Z for redo (Cmd+Shift+Z or Ctrl+Shift+Z)
          if (!canRedo) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          flushPendingSnapshots()
          redo()
          return
        }

        // Z for undo (Cmd+Z or Ctrl+Z)
        if (!canUndo) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        flushPendingSnapshots()
        undo()
        return
      }

      // Handle Y for redo (Ctrl+Y on Windows/Linux)
      if (key === 'y' && hasCtrl && !hasMeta) {
        if (!canRedo) {
          return
        }

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
