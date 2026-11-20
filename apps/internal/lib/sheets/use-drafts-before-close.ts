'use client'

import { useCallback } from 'react'

import { confirmDiscardDrafts } from './discard-guards'
import type { SheetSaveMode } from './save-mode'
import { useSheetStackEntry } from './stack-entry'

/**
 * Wraps a sheet's submit so Save and close first asks about an unsent
 * comment or lead update: those save on their own click, and closing the
 * sheet would drop them. Save (keep open) goes straight through.
 */
export function useDraftsBeforeClose<Values>(
  submit: (values: Values, mode: SheetSaveMode) => void
) {
  const stackId = useSheetStackEntry()?.id
  return useCallback(
    (values: Values, mode: SheetSaveMode = 'close') => {
      if (mode !== 'close') {
        submit(values, mode)
        return
      }
      confirmDiscardDrafts(stackId, () => submit(values, mode))
    },
    [stackId, submit]
  )
}
