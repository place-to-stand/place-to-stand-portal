'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { subscribeSheetOpen } from './pending-open'
import { getSheetWrapper } from './registry'
import { isStackItemClaimed, type SheetStackItem } from './stack'
import { SheetStackEntry } from './stack-entry'
import { useSheetParams } from './use-sheet-params'

/**
 * How long a closing sheet stays mounted so its exit transition can finish.
 * Matches `data-closed:duration-300` on SheetContent, plus a small buffer.
 */
const SHEET_CLOSE_MS = 350

type RenderedSheet = SheetStackItem & { open: boolean }

const signatureOf = (items: SheetStackItem[]) =>
  items.map(item => `${item.key}:${item.value}`).join('|')

/**
 * Global sheet host, mounted once in the dashboard layout. Renders an entity
 * sheet for every registered sheet param in the URL that the current page
 * doesn't handle itself (canonical host pages render their own instances for
 * instant warm-path opens — see `claimsPathname` in entities.ts).
 *
 * Sheets render in URL param order, so a later param's portal mounts after
 * (visually above) an earlier one — param order is stack order. The stack
 * may hold several sheets of one entity; each keeps its own entry (`key`).
 *
 * Closing flips `open` to false at once so the sheet animates out, and the
 * entry stays mounted until the transition finishes. Unmounting on the param
 * change alone would make the sheet vanish without animating.
 */
export function SheetHost() {
  const pathname = usePathname()
  const { stack, close } = useSheetParams()

  const foreign = stack.filter(item => !isStackItemClaimed(item, pathname))

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
        const stillOpen = foreign.some(item => item.key === entry.key)
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
    .map(entry => entry.key)
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

  // Mount on the click, not on the URL: an `open` that goes through the
  // server lands in `useSearchParams` late, which would lag the sheet.
  useEffect(() => {
    return subscribeSheetOpen(pending => {
      if (isStackItemClaimed(pending, pathname)) {
        return
      }
      setRendered(previous =>
        previous.some(entry => entry.key === pending.key)
          ? previous.map(entry =>
              entry.key === pending.key
                ? { ...entry, value: pending.value, open: true }
                : entry
            )
          : [...previous, { ...pending, open: true }]
      )
    })
  }, [pathname])

  const requestClose = useCallback(
    (closing: RenderedSheet) => {
      // Animate now, then update the URL.
      setRendered(previous =>
        previous.map(entry =>
          entry.key === closing.key ? { ...entry, open: false } : entry
        )
      )
      close(closing.entity, closing.value)
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
          <SheetStackEntry
            key={entry.key}
            entity={entry.entity}
            value={entry.open ? entry.value : null}
          >
            <Wrapper
              value={entry.value}
              open={entry.open}
              stack={stack}
              stackKey={entry.key}
              onRequestClose={() => requestClose(entry)}
            />
          </SheetStackEntry>
        )
      })}
    </>
  )
}
