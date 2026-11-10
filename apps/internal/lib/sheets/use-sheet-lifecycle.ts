'use client'

import { useCallback, useEffect, useRef, useTransition } from 'react'
import type { TransitionStartFunction } from 'react'

import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning'
import {
  useSaveConflict,
  type SaveConflictGuard,
} from '@/lib/sheets/save-conflict/use-save-conflict'
import { versionMs } from '@/lib/sheets/save-conflict/types'

type UnsavedChangesCopy = Parameters<typeof useUnsavedChangesWarning>[0]

export type UseSheetLifecycleArgs = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Unsaved work the close confirmation should warn about. */
  isDirty: boolean
  /**
   * Re-baseline the form to the entity's current values. Called when the
   * sheet opens, and again after it closes so discarded work (including
   * anything the sheet uploaded on the user's behalf) is cleaned up.
   */
  onReset: () => void
  /**
   * Identity of the entity in the sheet. The reset fires when this changes
   * while open — a create sheet becoming an edit sheet, or switching rows
   * without closing — but never on a same-id re-render, which would wipe
   * edits in progress every time the router refreshed.
   */
  resetKey?: string | null
  /**
   * Set false when the sheet builds its own opening state (prefill, a fetch,
   * catalog defaults) and a blanket re-baseline on open would fight it. The
   * post-close reset still runs — that one is about discarding, not building.
   */
  resetOnOpen?: boolean
  /** Overrides for the discard dialog's wording. */
  discardCopy?: Omit<UnsavedChangesCopy, 'isDirty'>
  /**
   * The record's `updated_at` as the sheet holds it. Each re-baseline takes
   * it as the version Save sends back (`saveConflict.expected()`), and a
   * newer one arriving while the form is clean re-baselines again, so an
   * untouched sheet follows the record and an edited one is never wiped.
   */
  version?: string | null
}

export type SheetLifecycle = {
  /**
   * A save or delete is in flight. This is the ONLY flag that may render as
   * "Saving..." — pass it to `getSubmitLabel({ isSaving })`.
   */
  isSaving: boolean
  /** Wraps a mutation. Sets `isSaving` for its duration. */
  startSave: TransitionStartFunction
  /**
   * Wraps work the user is not waiting on — re-baselining, prefetch
   * bookkeeping. Deliberately has no pending flag: a reset is not a save, and
   * a sheet that reports "Saving..." while resetting is lying about what it
   * is doing. It stays a transition so React keeps it off the urgent path
   * (and so `react-hooks/set-state-in-effect` stays satisfied).
   */
  startQuiet: TransitionStartFunction
  /** Wire straight to the sheet's `onOpenChange`. */
  handleSheetOpenChange: (next: boolean) => void
  unsavedChangesDialog: ReturnType<typeof useUnsavedChangesWarning>['dialog']
  /**
   * Run `next` once unsaved edits are dealt with: at once when clean, after
   * "Discard" when dirty (Duplicate from the Actions menu).
   */
  confirmDiscard: (next: () => void) => void
  /** The save check: send `expected()`, feed results to `catchConflict`. */
  saveConflict: SaveConflictGuard
}

/**
 * The open/close half of an entity sheet: transitions with honest meanings,
 * the re-baseline on open, and the guarded close.
 *
 * This exists because the same bug was written six times independently —
 * a form reset wrapped in the save transition, so every sheet announced
 * "Saving..." while closing an untouched form. Separating the transitions is
 * the fix; putting them behind one hook is what stops the seventh.
 */
export const useSheetLifecycle = ({
  open,
  onOpenChange,
  isDirty,
  onReset,
  resetKey = null,
  resetOnOpen = true,
  discardCopy,
  version = null,
}: UseSheetLifecycleArgs): SheetLifecycle => {
  const [isSaving, startSaveTransition] = useTransition()
  const [, startQuietTransition] = useTransition()

  const { requestConfirmation, dialog: unsavedChangesDialog } =
    useUnsavedChangesWarning({ isDirty, ...discardCopy })

  // `undefined` means "closed / not yet baselined", which is distinct from a
  // create sheet's `null` key.
  const lastResetKeyRef = useRef<string | null | undefined>(undefined)
  const saveConflict = useSaveConflict()
  // The version the form was last re-baselined to.
  const seededVersionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      lastResetKeyRef.current = undefined
      return
    }

    if (!resetOnOpen) {
      return
    }

    if (
      lastResetKeyRef.current !== undefined &&
      lastResetKeyRef.current === resetKey
    ) {
      return
    }

    lastResetKeyRef.current = resetKey
    seededVersionRef.current = version
    saveConflict.seed(version)
    startQuietTransition(() => {
      onReset()
    })
  }, [
    open,
    resetKey,
    resetOnOpen,
    onReset,
    startQuietTransition,
    version,
    saveConflict,
  ])

  // A newer version of the same record (a refresh after someone's save, or
  // Load theirs) re-baselines a clean form. A dirty one keeps its edits;
  // Save then reports the conflict.
  useEffect(() => {
    if (!open || lastResetKeyRef.current !== resetKey) return
    if (version === seededVersionRef.current || isDirty) return
    // This sheet's own save (an overwrite, a keep-open save) already holds
    // this version or a newer one: an older copy arriving late must not
    // roll the form back to it.
    const held = saveConflict.expected()
    if (held && version && versionMs(version) <= versionMs(held)) {
      seededVersionRef.current = version
      return
    }
    seededVersionRef.current = version
    saveConflict.seed(version)
    startQuietTransition(() => {
      onReset()
    })
  }, [
    open,
    resetKey,
    version,
    isDirty,
    onReset,
    saveConflict,
    startQuietTransition,
  ])

  const handleSheetOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true)
        return
      }

      requestConfirmation(() => {
        // Close first, re-baseline after. The reset still has to run, but
        // nothing about it needs to happen before the sheet starts moving.
        onOpenChange(false)
        startQuietTransition(() => {
          onReset()
        })
      })
    },
    [onOpenChange, onReset, requestConfirmation, startQuietTransition]
  )

  return {
    isSaving,
    startSave: startSaveTransition,
    startQuiet: startQuietTransition,
    handleSheetOpenChange,
    unsavedChangesDialog,
    confirmDiscard: requestConfirmation,
    saveConflict,
  }
}
