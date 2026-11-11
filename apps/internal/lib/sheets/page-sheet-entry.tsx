'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import type { SheetEntityKey } from './entities'
import { isStackItemClaimed } from './stack'
import { SheetStackEntry } from './stack-entry'
import { useSheetParams } from './use-sheet-params'

/**
 * Wraps a sheet a page renders itself (an entity's list page) as its stack
 * entry: the entity's first param, when this page claims it.
 */
export function PageSheetEntry({
  entity,
  children,
}: {
  entity: SheetEntityKey
  children: ReactNode
}) {
  const pathname = usePathname()
  const { stack } = useSheetParams()
  const item = stack.find(entry => entry.entity === entity)
  const value = item && isStackItemClaimed(item, pathname) ? item.value : null
  return (
    <SheetStackEntry entity={entity} value={value}>
      {children}
    </SheetStackEntry>
  )
}
