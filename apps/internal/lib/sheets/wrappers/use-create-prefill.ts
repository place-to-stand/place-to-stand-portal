'use client'

import { useState } from 'react'

import { NEW_SHEET_VALUE } from '../entities'
import { useSheetStackEntry } from '../stack-entry'
import { useSheetParams } from '../use-sheet-params'

/**
 * A create sheet's prefill (`contactName`, `projectCompanyId`, …), read once
 * when the sheet mounts: from the open that stacked it, else the URL. Read
 * live, a second draft of the entity opening above would rewrite it. The
 * URL holds the first draft's prefill only, so a later draft without an
 * open behind it (a reload) starts empty.
 */
export function useCreatePrefill<K extends string>(
  value: string,
  aux: Record<string, string> | undefined,
  keys: readonly K[]
): Partial<Record<K, string>> {
  const { getAux } = useSheetParams()
  const entry = useSheetStackEntry()
  const [prefill] = useState(() => {
    const result: Partial<Record<K, string>> = {}
    if (value !== NEW_SHEET_VALUE) return result
    const firstDraft = !entry?.id || entry.id.endsWith(`:${NEW_SHEET_VALUE}:0`)
    if (!aux && !firstDraft) return result
    for (const key of keys) {
      const found = aux ? aux[key] : getAux(key)
      if (found) result[key] = found
    }
    return result
  })
  return prefill
}

/**
 * The stack id this sheet opened with (a create sheet's `contact:new:1`),
 * kept after a keep-open save swaps it: a new record goes back to the
 * picker that opened this sheet (see created.ts).
 */
export function useOpenedStackId() {
  const entry = useSheetStackEntry()
  const [id] = useState(() => entry?.id ?? null)
  return id
}
