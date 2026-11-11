/**
 * Open sheets with unsaved changes, by stack entry. Going back to a sheet
 * lower in the stack closes the sheets above it, and each one with unsaved
 * changes asks first, exactly as its own Close would.
 */

import type { SheetEntityKey } from './entities'

type Confirm = (next: () => void) => void

// A set per entry: a dialog inside a sheet (emailing an invoice) guards
// its own unsaved work under the same entry.
const guards = new Map<string, Set<Confirm>>()

const guardKey = (entity: SheetEntityKey, value: string) => `${entity}:${value}`

/** Called by a sheet while it has unsaved changes. Returns the unregister. */
export function registerDiscardGuard(
  entity: SheetEntityKey,
  value: string,
  confirm: Confirm
) {
  const key = guardKey(entity, value)
  const set = guards.get(key) ?? new Set<Confirm>()
  set.add(confirm)
  guards.set(key, set)
  return () => {
    set.delete(confirm)
    if (set.size === 0 && guards.get(key) === set) {
      guards.delete(key)
    }
  }
}

/**
 * Runs `next` once every listed sheet's unsaved changes are dealt with, top
 * sheet first. "Stay" on any of them stops there and nothing closes.
 */
export function confirmDiscardAll(
  sheets: { entity: SheetEntityKey; value: string }[],
  next: () => void
) {
  const confirms = sheets.flatMap(sheet => [
    ...(guards.get(guardKey(sheet.entity, sheet.value)) ?? []),
  ])
  const run = (index: number) => {
    const confirm = confirms[index]
    if (confirm) {
      confirm(() => run(index + 1))
    } else {
      next()
    }
  }
  run(0)
}
