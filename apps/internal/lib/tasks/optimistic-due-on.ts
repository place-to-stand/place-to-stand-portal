'use client'

import { useSyncExternalStore } from 'react'

/**
 * Due dates set from a task card's right-click menu, shown before the save
 * returns. Every task surface (project board, My Tasks, the lead sheet)
 * holds its own copy of the task, so the override lives here instead and the
 * card reads through it.
 *
 * Each entry remembers the dates the card may still hold while the save is
 * in flight (`stale`: the date before, plus any earlier pick not yet
 * refreshed). The card shows the override only while its own value is one of
 * those; the saved date, or any other date (a sheet edit), ends it. A settled
 * save also expires its entry after `SETTLED_TTL_MS`, so an entry never
 * outlives a card that unmounted before the refresh landed.
 */
type Override = {
  token: number
  stale: ReadonlySet<string | null>
  value: string | null
}

const SETTLED_TTL_MS = 10_000

const overrides = new Map<string, Override>()
const listeners = new Set<() => void>()
let nextToken = 0

function emit() {
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Shows `value` on the task's cards until fresh data arrives. `own` is the
 * date the card holds now. Returns a token for `settleOptimisticDueOn`.
 */
export function setOptimisticDueOn(
  taskId: string,
  own: string | null,
  value: string | null
): number {
  const previous = overrides.get(taskId)
  const stale = new Set(previous?.stale ?? [])
  stale.add(own)
  if (previous) stale.add(previous.value)
  stale.delete(value)
  const token = ++nextToken
  overrides.set(taskId, { token, stale, value })
  emit()
  return token
}

/**
 * The save finished. A failure drops the entry at once (the card goes back to
 * its own date); a success lets it run until fresh data replaces it, at most
 * `SETTLED_TTL_MS`. A newer pick's entry is left alone either way.
 */
export function settleOptimisticDueOn(
  taskId: string,
  token: number,
  ok: boolean
) {
  const drop = () => {
    if (overrides.get(taskId)?.token !== token) return
    overrides.delete(taskId)
    emit()
  }
  if (ok) setTimeout(drop, SETTLED_TTL_MS)
  else drop()
}

/** The task's due date as the card should show it. */
export function useOptimisticDueOn(task: {
  id: string
  due_on: string | null
}): string | null {
  // The entry itself is the snapshot (entries are replaced, never mutated),
  // so React, and the React Compiler's memoisation, see every change.
  const read = () => overrides.get(task.id)
  const override = useSyncExternalStore(subscribe, read, read)
  const own = task.due_on ?? null
  return override && override.stale.has(own) ? override.value : own
}
