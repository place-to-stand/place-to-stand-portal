'use client'

import type { SheetStackItem } from './stack'

type PendingOpen = SheetStackItem

type Listener = (pending: PendingOpen) => void

const listeners = new Set<Listener>()

/**
 * Announces a sheet open the instant the user acts, before the URL write
 * lands. Most writes skip the server, but an `open` that needs it (see
 * `useSheetParams`) reaches `useSearchParams` only after the server answers,
 * so the SheetHost mounts on this signal and the URL catches up after.
 */
export const emitSheetOpen = (pending: PendingOpen) => {
  for (const listener of listeners) {
    listener(pending)
  }
}

export const subscribeSheetOpen = (listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
