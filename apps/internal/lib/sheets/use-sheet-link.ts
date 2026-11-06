'use client'

import { useCallback, type MouseEvent } from 'react'

import type { SheetEntityKey } from './entities'
import { useSheetParams } from './use-sheet-params'

/** The record a link opens: its sheet param and id (`company`, `<uuid>`). */
export type SheetTarget = {
  entity: SheetEntityKey
  id: string
}

/** True for a click the browser should handle (new tab, new window). */
export const isModifiedClick = (event: MouseEvent) =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey

/**
 * A link to a record's sheet that opens it over the current page instead of
 * leaving for the record's list. The href is this page with the sheet on top
 * of the stack, so a new-tab click lands on the same view. Returns the
 * anchor's `href` and `onClick`; `onOpen` runs after a plain click opened it.
 */
export function useSheetLink({ entity, id }: SheetTarget, onOpen?: () => void) {
  const { get, hrefFor, open } = useSheetParams()

  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(event)) {
        return
      }
      event.preventDefault()
      if (get(entity) !== id) {
        open(entity, id)
      }
      onOpen?.()
    },
    [entity, get, id, onOpen, open]
  )

  return { href: hrefFor(entity, id), onClick }
}
