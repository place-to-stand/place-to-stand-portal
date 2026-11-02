'use client'

import type { SheetEntityKey } from './entities'

type PendingOpen = { entity: SheetEntityKey; value: string }

type Listener = (pending: PendingOpen) => void

const listeners = new Set<Listener>()

/**
 * Announces a sheet open the instant the user acts, before the URL write
 * lands. Most writes skip the server, but an `open` that needs it (see
 * `useSheetParams`) reaches `useSearchParams` only after the server answers,
 * so the SheetHost mounts on this signal and the URL catches up after.
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
