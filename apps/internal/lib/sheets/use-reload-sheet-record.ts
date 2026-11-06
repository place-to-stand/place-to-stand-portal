'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import type { SheetEntityKey } from './entities'
import { emitSheetRecordSaved } from './record-saved'

/**
 * Fetches an open sheet's record again: the SheetHost's copy (see
 * `record-saved.ts`) and the page's. The sheet re-seeds when the newer
 * version arrives. Used by the save-conflict dialog's Load theirs.
 */
export function useReloadSheetRecord(
  entity: SheetEntityKey,
  recordId: string | null
) {
  const router = useRouter()
  return useCallback(() => {
    if (recordId) emitSheetRecordSaved(entity, recordId)
    router.refresh()
  }, [entity, recordId, router])
}
