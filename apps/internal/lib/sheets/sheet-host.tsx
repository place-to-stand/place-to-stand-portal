'use client'

import { usePathname } from 'next/navigation'

import { isSheetEntityClaimed } from './entities'
import { getSheetWrapper } from './registry'
import { useSheetParams } from './use-sheet-params'

/**
 * Global sheet host, mounted once in the dashboard layout. Renders an entity
 * sheet for every registered sheet param in the URL that the current page
 * doesn't handle itself (canonical host pages render their own instances for
 * instant warm-path opens — see `claimsPathname` in entities.ts).
 *
 * Foreign sheets render in URL param order, so a later param's portal mounts
 * after (visually above) an earlier one — param order is stack order.
 */
export function SheetHost() {
  const pathname = usePathname()
  const { stack } = useSheetParams()

  const foreign = stack.filter(
    item => !isSheetEntityClaimed(item.entity, pathname, item.value)
  )

  if (foreign.length === 0) {
    return null
  }

  return (
    <>
      {foreign.map(item => {
        const Wrapper = getSheetWrapper(item.entity)
        if (!Wrapper) {
          return null
        }
        return (
          <Wrapper key={item.entity} value={item.value} stack={stack} />
        )
      })}
    </>
  )
}
