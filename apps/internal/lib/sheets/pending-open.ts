'use client'

import type { SheetEntityKey } from './entities'

type PendingOpen = { entity: SheetEntityKey; value: string }

type Listener = (pending: PendingOpen) => void

const listeners = new Set<Listener>()

/**
 * Announces a sheet open the instant the user acts, before the URL write
 * lands. `router.push` on a query change still round-trips to the server for
 * the RSC payload, so a host-rendered sheet that waited for `useSearchParams`
 * would visibly lag the click. The SheetHost mounts on this signal and the
 * URL reconciles a moment later.
 */
export const emitSheetOpen = (entity: SheetEntityKey, value: string) => {
  for (const listener of listeners) {
    listener({ entity, value })
  }
}

export const subscribeSheetOpen = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
