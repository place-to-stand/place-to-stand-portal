'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { isSheetEntityClaimed, type SheetEntityKey } from './entities'
import { subscribeSheetOpen } from './pending-open'
import { getSheetWrapper } from './registry'
import { useSheetParams, type SheetStackItem } from './use-sheet-params'

/**
 * How long a closing sheet stays mounted so its exit transition can finish.
 * Matches `data-closed:duration-300` on SheetContent, plus a small buffer.
 */
const SHEET_CLOSE_MS = 350

type RenderedSheet = SheetStackItem & { open: boolean }

const signatureOf = (items: SheetStackItem[]) =>
  items.map(item => `${item.entity}:${item.value}`).join('|')

/**
 * Global sheet host, mounted once in the dashboard layout. Renders an entity
 * sheet for every registered sheet param in the URL that the current page
 * doesn't handle itself (canonical host pages render their own instances for
 * instant warm-path opens — see `claimsPathname` in entities.ts).
 *
 * Sheets render in URL param order, so a later param's portal mounts after
 * (visually above) an earlier one — param order is stack order.
 *
 * Closing is optimistic: `open` flips to false immediately so the sheet
 * animates out while the URL write lands, and the entry stays mounted until
 * the transition finishes. Unmounting on the param change alone would make
 * the sheet vanish without animating, one server round-trip late.
 */
export function SheetHost() {
  const pathname = usePathname()
  const { stack, close } = useSheetParams()

  const foreign = stack.filter(
    item => !isSheetEntityClaimed(item.entity, pathname, item.value)
  )

  const [rendered, setRendered] = useState<RenderedSheet[]>(() =>
    foreign.map(item => ({ ...item, open: true }))
  )

  // Adopt URL changes (own state only — safe during render).
  const signature = signatureOf(foreign)
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    setRendered(previous => {
      const next: RenderedSheet[] = foreign.map(item => ({
        ...item,
        open: true,
      }))
      // Keep entries the URL dropped mounted (closed) so they animate out.
      for (const entry of previous) {
        const stillOpen = foreign.some(item => item.entity === entry.entity)
        if (!stillOpen) {
          next.push({ ...entry, open: false })
        }
      }
      return next
    })
  }

  // Drop closed entries once their transition has finished.
  const closedKeys = rendered
    .filter(entry => !entry.open)
    .map(entry => entry.entity)
    .join('|')
  useEffect(() => {
    if (!closedKeys) {
      return
    }

    const timeout = setTimeout(() => {
      setRendered(previous => previous.filter(entry => entry.open))
    }, SHEET_CLOSE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [closedKeys])

  // Mount on the click, not on the URL — `open` round-trips to the server
  // before `useSearchParams` reflects it, which would lag the sheet visibly.
  useEffect(() => {
    return subscribeSheetOpen(pending => {
      if (isSheetEntityClaimed(pending.entity, pathname, pending.value)) {
        return
      }
      setRendered(previous =>
        previous.some(entry => entry.entity === pending.entity)
          ? previous.map(entry =>
              entry.entity === pending.entity
                ? { ...entry, value: pending.value, open: true }
                : entry
            )
          : [...previous, { ...pending, open: true }]
      )
    })
  }, [pathname])

  const requestClose = useCallback(
    (entity: SheetEntityKey) => {
      // Animate now, update the URL after — `close` is a server round-trip.
      setRendered(previous =>
        previous.map(entry =>
          entry.entity === entity ? { ...entry, open: false } : entry
        )
      )
      close(entity)
    },
    [close]
  )

  if (rendered.length === 0) {
    return null
  }

  return (
    <>
      {rendered.map(entry => {
        const Wrapper = getSheetWrapper(entry.entity)
        if (!Wrapper) {
          return null
        }
        return (
          <Wrapper
            key={entry.entity}
            value={entry.value}
            open={entry.open}
            stack={stack}
            onRequestClose={() => requestClose(entry.entity)}
          />
        )
      })}
    </>
  )
}
