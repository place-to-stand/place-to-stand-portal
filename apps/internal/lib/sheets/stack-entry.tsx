'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { SheetEntityKey } from './entities'

export type SheetStackEntryValue = {
  entity: SheetEntityKey
  /** The sheet's param value (`<uuid>`, `new`, `copy-<uuid>`); null while closed. */
  value: string | null
}

const SheetStackEntryContext = createContext<SheetStackEntryValue | null>(null)

/**
 * Tells a sheet which stack entry it is, so code deep inside it (the unsaved
 * changes guard, a keep-open save) acts on its own param when the stack
 * holds several sheets of one entity. The SheetHost wraps every sheet it
 * renders; a page that renders its own sheet wraps it with the first param
 * of its entity (`usePageSheetEntry`).
 */
export function SheetStackEntry({
  entity,
  value,
  children,
}: SheetStackEntryValue & { children: ReactNode }) {
  return (
    <SheetStackEntryContext value={{ entity, value }}>
      {children}
    </SheetStackEntryContext>
  )
}

/** The stack entry of the sheet this component sits in, if any. */
export const useSheetStackEntry = () => useContext(SheetStackEntryContext)
