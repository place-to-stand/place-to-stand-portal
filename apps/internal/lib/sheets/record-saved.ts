'use client'

import type { SheetEntityKey } from './entities'

type RecordSaved = { entity: SheetEntityKey; id: string }

type Listener = (saved: RecordSaved) => void

const listeners = new Set<Listener>()

/**
 * Announces that a sheet saved a record and stays open on it. Sheets the
 * SheetHost serves hold their record from `/api/sheets/init`, which a
 * `router.refresh()` doesn't reload, so their wrapper listens here and
 * fetches the record again.
 */
export const emitSheetRecordSaved = (entity: SheetEntityKey, id: string) => {
  for (const listener of listeners) {
    listener({ entity, id })
  }
}

export const subscribeSheetRecordSaved = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
