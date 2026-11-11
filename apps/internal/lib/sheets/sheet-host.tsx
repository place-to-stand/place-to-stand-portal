'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

type RenderedSheet = {
  /**
   * React key. Assigned when the sheet opens and kept until it's gone, so
   * the sheet never remounts while its stack around it changes (a sheet
   * below it closing, its own create sheet becoming the saved record).
   */
  key: string
  item: SheetStackItem
  open: boolean
  /** Create-sheet prefill from the open that stacked it. */
  aux?: Record<string, string>
}

let nextKey = 0
const newKey = () => `sheet-${(nextKey += 1)}`

/**
 * React keys by stack id, assigned outside state updaters (React may run an
 * updater again) and kept while the sheet is open.
 */
const keysById = new Map<string, string>()
const keyFor = (id: string) => {
  const existing = keysById.get(id)
  if (existing) return existing
  const key = newKey()
  keysById.set(id, key)
  return key
}

const signatureOf = (items: SheetStackItem[]) =>
  items.map(item => item.id).join('|')

/**
 * Global sheet host, mounted once in the dashboard layout. Renders an entity
 * sheet for every registered sheet param in the URL that the current page
 * doesn't handle itself (canonical host pages render their own instances for
 * instant warm-path opens — see `claimsPathname` in entities.ts).
 *
 * Sheets render in URL param order, so a later param's portal mounts after
 * (visually above) an earlier one — param order is stack order. The stack
 * may hold several sheets of one entity; each is its own entry.
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
    foreign.map(item => ({ key: keyFor(item.id), item, open: true }))
  )

  // Adopt URL changes (own state only — safe during render).
  const signature = signatureOf(foreign)
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setLastSignature(signature)
    const keys = foreign.map(item => keyFor(item.id))
    setRendered(previous => {
      const unmatched = [...previous]
      const next: RenderedSheet[] = foreign.map((item, index) => {
        // An open entry first: one with this id may still be animating out.
        const openAt = unmatched.findIndex(
          entry => entry.item.id === item.id && entry.open
        )
        const at =
          openAt === -1
            ? unmatched.findIndex(entry => entry.item.id === item.id)
            : openAt
        const match = at === -1 ? null : unmatched.splice(at, 1)[0]
        return {
          key: match?.key ?? keys[index]!,
          item,
          open: true,
          aux: match?.aux,
        }
      })
      // Keep entries the URL dropped mounted (closed) so they animate out.
      for (const entry of unmatched) {
        next.push({ ...entry, open: false })
      }
      return next
    })
  }

  const renderedRef = useRef(rendered)
  useEffect(() => {
    renderedRef.current = rendered
  })

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
      setRendered(previous => {
        for (const entry of previous) {
          if (!entry.open && keysById.get(entry.item.id) === entry.key) {
            keysById.delete(entry.item.id)
          }
        }
        return previous.filter(entry => entry.open)
      })
    }, SHEET_CLOSE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [closedKeys])

  // Mount on the click, not on the URL: an `open` that goes through the
  // server lands in `useSearchParams` late, which would lag the sheet.
  useEffect(() => {
    return subscribeSheetOpen(pending => {
      if (isStackItemClaimed(pending.item, pathname)) {
        return
      }
      if (pending.kind === 'swap') {
        // A swap keeps the sheet's key under its new id. The old id lets go
        // of it: a later draft can get that id and must not share the key.
        const key = keysById.get(pending.from) ?? keyFor(pending.item.id)
        keysById.delete(pending.from)
        keysById.set(pending.item.id, key)
        setRendered(previous =>
          previous.map(entry =>
            entry.item.id === pending.from
              ? { ...entry, key, item: pending.item, open: true }
              : entry
          )
        )
        return
      }
      // An open is always a fresh sheet, even when one with this id is
      // still animating out: that one keeps its key and goes.
      if (
        renderedRef.current.some(
          entry => entry.item.id === pending.item.id && entry.open
        )
      ) {
        return
      }
      keysById.delete(pending.item.id)
      const key = keyFor(pending.item.id)
      setRendered(previous =>
        previous.some(entry => entry.item.id === pending.item.id && entry.open)
          ? previous
          : [
              ...previous,
              { key, item: pending.item, open: true, aux: pending.aux },
            ]
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
      close(closing.item.entity, closing.item.id)
    },
    [close]
  )

  if (rendered.length === 0) {
    return null
  }

  return (
    <>
      {rendered.map(entry => {
        const Wrapper = getSheetWrapper(entry.item.entity)
        if (!Wrapper) {
          return null
        }
        return (
          <SheetStackEntry
            key={entry.key}
            entity={entry.item.entity}
            value={entry.open ? entry.item.value : null}
            id={entry.open ? entry.item.id : null}
            position={entry.item.position}
          >
            <Wrapper
              value={entry.item.value}
              open={entry.open}
              stack={stack}
              stackId={entry.item.id}
              aux={entry.aux}
              onRequestClose={() => requestClose(entry)}
            />
          </SheetStackEntry>
        )
      })}
    </>
  )
}
