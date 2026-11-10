import { useEffect, useRef } from 'react'

import { matchesShortcut } from '@/lib/keyboard/match'
import { SHORTCUTS } from '@/lib/keyboard/shortcuts'
import { announceSaveMode, type SheetSaveMode } from '@/lib/sheets/save-mode'

export type KeyboardShortcutArgs = {
  isActive: boolean
  canSave: boolean
  onSave: (mode: SheetSaveMode) => void
  undo: () => void
  redo: () => void
  flushPendingSnapshots: () => void
}

/**
 * Open sheets, in the order they opened. Only the last one (the sheet on
 * top) answers the keys: every sheet listens on the window, so without this
 * one ⌘Z in a stacked sheet would also undo the sheet under it.
 */
const openSheets: symbol[] = []

/** Marks an element that runs its own undo (a comment composer). */
export const OWN_UNDO_ATTRIBUTE = 'data-own-undo'

/**
 * Focus is somewhere the sheet's history doesn't own: an editor with its own
 * undo, or a dialog, popover or picker open over the sheet.
 */
function focusOwnsUndo(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  if (target.closest(`[${OWN_UNDO_ATTRIBUTE}]`)) return true
  const dialog = target.closest('[role="dialog"], [role="alertdialog"]')
  return Boolean(dialog && dialog.getAttribute('data-slot') !== 'sheet-content')
}

export function useHistoryKeyboardShortcuts({
  isActive,
  canSave,
  onSave,
  undo,
  redo,
  flushPendingSnapshots,
}: KeyboardShortcutArgs) {
  const tokenRef = useRef<symbol | null>(null)

  useEffect(() => {
    if (!isActive) return
    const token = Symbol('sheet')
    tokenRef.current = token
    openSheets.push(token)
    return () => {
      const index = openSheets.indexOf(token)
      if (index !== -1) openSheets.splice(index, 1)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const onTop = openSheets[openSheets.length - 1] === tokenRef.current

      // ⌘S saves and closes; ⇧⌘S saves and keeps the sheet open.
      const stay = matchesShortcut(event, SHORTCUTS.saveAndStay)
      if (stay || matchesShortcut(event, SHORTCUTS.save)) {
        // Claim the key even when saving is blocked, so the browser's own
        // Save (or Save As) dialog never opens over a sheet.
        event.preventDefault()
        event.stopPropagation()
        if (!onTop || !canSave) return
        flushPendingSnapshots()
        const mode = stay ? 'stay' : 'close'
        announceSaveMode(mode)
        onSave(mode)
        return
      }

      const isUndo = matchesShortcut(event, SHORTCUTS.undo)
      const isRedo = !isUndo && matchesShortcut(event, SHORTCUTS.redo)
      if (!isUndo && !isRedo) return
      if (!onTop || focusOwnsUndo(event.target)) return

      // The sheet owns undo and redo, even while an input or the editor has
      // focus, and even with nothing to step to: the browser's own text undo
      // would change a field behind the sheet's history.
      event.preventDefault()
      event.stopPropagation()
      // Not gated on canUndo/canRedo: those trail an edit typed in the last
      // moment, which undo() records first (it flushes, then steps if it can).
      if (isUndo) undo()
      else redo()
    }

    // Use capture phase to intercept events before they reach inputs/editors
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      flushPendingSnapshots()
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [canSave, flushPendingSnapshots, isActive, onSave, redo, undo])
}
