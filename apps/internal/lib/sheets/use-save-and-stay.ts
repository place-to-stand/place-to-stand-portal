'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { SheetEntityKey } from './entities'
import { emitSheetRecordSaved } from './record-saved'
import { useSheetParams } from './use-sheet-params'

type StayArgs = {
  /** The saved record's id (a create returns the new one). */
  id: string | null | undefined
  /**
   * Make what was just saved the form's clean state, so the sheet no longer
   * reads as dirty. Only an edit sheet calls it: a create sheet reloads as
   * the new record's sheet instead.
   */
  rebaseline: () => void
}

/**
 * The "keep open" half of a sheet save (see `SheetSaveMode`). Call `stay`
 * where the sheet would otherwise close after a successful save.
 *
 * - Edit sheet: re-baselines the form, reloads the record (see
 *   `record-saved.ts`) and refreshes the page behind it.
 * - Create sheet: swaps the URL's `new` for the created id, so the sheet
 *   reloads as that record's edit sheet. Until the record arrives,
 *   `isReopening` is true: OR it into the sheet's save-disabled flag, or a
 *   second press would create the record twice.
 */
export function useSaveAndStay(
  entity: SheetEntityKey,
  /** The record the sheet is showing; null on a create sheet. */
  recordId: string | null,
  /** Whether the sheet is open: closing it stops any wait. */
  open: boolean
) {
  const router = useRouter()
  const { swap } = useSheetParams()
  const [pendingId, setPendingId] = useState<string | null>(null)

  // The created record has arrived, or the sheet closed: done waiting.
  if (pendingId !== null && (recordId === pendingId || !open)) {
    setPendingId(null)
  }

  const stay = useCallback(
    ({ id, rebaseline }: StayArgs) => {
      if (recordId || !id) {
        rebaseline()
        if (recordId) {
          emitSheetRecordSaved(entity, recordId)
        }
        router.refresh()
        return
      }
      setPendingId(id)
      swap(entity, id)
      router.refresh()
    },
    [entity, recordId, router, swap]
  )

  return {
    stay,
    isReopening: pendingId !== null && pendingId !== recordId,
  }
}
