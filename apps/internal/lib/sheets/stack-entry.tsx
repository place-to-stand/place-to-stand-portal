'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { SheetEntityKey } from './entities'

export type SheetStackEntryValue = {
  entity: SheetEntityKey
  /** The sheet's param value (`<uuid>`, `new`, `copy-<uuid>`); null while closed. */
  value: string | null
  /** Its stack id (`SheetStackItem.id`); null while closed. */
  id: string | null
  /** Its place in the stack, 0 for the bottom: sets how it layers. */
  position?: number
}

const SheetStackEntryContext = createContext<SheetStackEntryValue | null>(null)

/**
 * Tells a sheet which stack entry it is, so code deep inside it (the unsaved
 * changes guard, a keep-open save, a failed load) acts on its own param when
 * the stack holds several sheets of one entity. The SheetHost wraps every
 * sheet it renders; a page that renders its own sheet wraps it in
 * `PageSheetEntry`.
 */
export function SheetStackEntry({
  entity,
  value,
  id,
  position,
  children,
}: SheetStackEntryValue & { children: ReactNode }) {
  return (
    <SheetStackEntryContext value={{ entity, value, id, position }}>
      {children}
    </SheetStackEntryContext>
  )
}

/** The stack entry of the sheet this component sits in, if any. */
export const useSheetStackEntry = () => useContext(SheetStackEntryContext)

/**
 * A sheet's z-index from its stack position, so a sheet above another always
 * covers it, whichever finished loading first (portals stack in mount
 * order). 40 up, under the z-50 popovers, menus and dialogs a sheet opens.
 */
export const sheetLayerZ = (position: number | undefined) =>
  40 + Math.min(Math.max(position ?? 0, 0), 9)
