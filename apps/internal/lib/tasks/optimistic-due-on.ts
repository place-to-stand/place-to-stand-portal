'use client'

import { useSyncExternalStore } from 'react'

/**
 * Due dates set from a task card's right-click menu, shown before the save
 * returns. Every task surface (project board, My Tasks, the lead sheet)
 * holds its own copy of the task, so the override lives here instead and the
 * card reads through it.
 *
 * Each entry remembers the due date the card held when it was set (`base`).
 * Once fresh data arrives the card's own value differs from `base` and the
 * entry stops applying, so a later edit from the sheet is never masked.
 */
type Override = { base: string | null; value: string | null }

const overrides = new Map<string, Override>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getVersion = () => version

/** Shows `value` on the task's cards until fresh data replaces `base`. */
export function setOptimisticDueOn(
  taskId: string,
  base: string | null,
  value: string | null
) {
  overrides.set(taskId, { base, value })
  emit()
}

/** Drops the override (the save failed), so the card shows its own value. */
export function clearOptimisticDueOn(taskId: string) {
  if (overrides.delete(taskId)) emit()
}

/** The task's due date as the card should show it. */
export function useOptimisticDueOn(task: {
  id: string
  due_on: string | null
}): string | null {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const override = overrides.get(task.id)
  const own = task.due_on ?? null
  if (!override) return own
  if (override.base === own && override.value !== own) return override.value
  // Fresh data has arrived (the saved date, or a newer edit): the entry is
  // spent. Dropping it without emitting is safe, since the card already
  // shows its own value; it keeps a later return to `base` from reviving it.
  overrides.delete(task.id)
  return own
}
