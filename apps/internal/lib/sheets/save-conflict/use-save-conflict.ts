'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

import type { SheetSaveMode } from '@/lib/sheets/save-mode'

import type { SaveConflict } from './types'

export type SaveConflictGuard = {
  /**
   * The version the form's values are based on. Call it exactly where the
   * sheet seeds its form from the record (open, re-seed after a refetch),
   * and with the `updatedAt` a successful save returns.
   */
  seed: (updatedAt: string | null | undefined) => void
  /**
   * After a successful save: `seed` with the version the save returned, and
   * tell anyone listening (the sheet's presence, so others hear of it).
   */
  saved: (updatedAt: string | null | undefined) => void
  /** Listen for this sheet's own saves. Returns the unsubscribe. */
  onSaved: (listener: (updatedAt: string) => void) => () => void
  /** What Save sends as its expected version. Undefined for a new record. */
  expected: () => string | undefined
  /**
   * Feed it a save result and the save mode it was sent with. Returns true
   * when it was a conflict: the dialog is open, and the sheet should stop
   * there, keep the form as it is and show no error toast. Overwrite sends
   * the save again in the same mode (Save and close, or Save).
   */
  catchConflict: (
    result: { conflict?: SaveConflict },
    mode: SheetSaveMode
  ) => boolean
  /** The open conflict, for `SaveConflictDialog`. */
  conflict: SaveConflict | null
  /** Closes the dialog, leaving the form as it is. */
  dismiss: () => void
  /**
   * Closes the dialog and makes the next save expect the newer version.
   * Returns the mode to send that save in.
   */
  overwrite: () => SheetSaveMode
}

/**
 * The client half of the save check every sheet shares. The server refuses
 * a save whose expected version is not the record's current one; this
 * tracks the version the form is based on, and `SaveConflictDialog` turns
 * a refusal into the Overwrite / Load theirs / Keep editing choice.
 *
 * Overwrite is not a force flag: it re-sends the save expecting the
 * version that refused it, so a third save landing meanwhile is caught too.
 */
export function useSaveConflict(): SaveConflictGuard {
  const versionRef = useRef<string | null>(null)
  const [conflict, setConflict] = useState<SaveConflict | null>(null)
  const modeRef = useRef<SheetSaveMode>('close')

  const seed = useCallback((updatedAt: string | null | undefined) => {
    versionRef.current = updatedAt ?? null
  }, [])

  const expected = useCallback(() => versionRef.current ?? undefined, [])

  const listenersRef = useRef(new Set<(updatedAt: string) => void>())
  const saved = useCallback((updatedAt: string | null | undefined) => {
    versionRef.current = updatedAt ?? null
    if (!updatedAt) return
    for (const listener of listenersRef.current) listener(updatedAt)
  }, [])
  const onSaved = useCallback((listener: (updatedAt: string) => void) => {
    const listeners = listenersRef.current
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const catchConflict = useCallback(
    (result: { conflict?: SaveConflict }, mode: SheetSaveMode) => {
      if (!result.conflict) return false
      modeRef.current = mode
      setConflict(result.conflict)
      return true
    },
    []
  )

  const dismiss = useCallback(() => setConflict(null), [])

  const overwrite = useCallback(() => {
    if (conflict) versionRef.current = conflict.savedAt
    setConflict(null)
    return modeRef.current
  }, [conflict])

  return useMemo(
    () => ({
      seed,
      saved,
      onSaved,
      expected,
      catchConflict,
      conflict,
      dismiss,
      overwrite,
    }),
    [
      seed,
      saved,
      onSaved,
      expected,
      catchConflict,
      conflict,
      dismiss,
      overwrite,
    ]
  )
}
