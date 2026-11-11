/**
 * Open sheets with unsaved changes, by stack id (`SheetStackItem.id`).
 * Going back to a sheet lower in the stack closes the sheets above it, and
 * each one with unsaved changes asks first, as its own Close would.
 */

type Confirm = (next: () => void) => void

// A set per sheet: a dialog inside a sheet (emailing an invoice) guards its
// own unsaved work under the same id.
const guards = new Map<string, Set<Confirm>>()

/** Called by a sheet while it has unsaved changes. Returns the unregister. */
export function registerDiscardGuard(id: string, confirm: Confirm) {
  const set = guards.get(id) ?? new Set<Confirm>()
  set.add(confirm)
  guards.set(id, set)
  return () => {
    set.delete(confirm)
    if (set.size === 0 && guards.get(id) === set) {
      guards.delete(id)
    }
  }
}

/**
 * Runs `next` once every listed sheet's unsaved changes are dealt with, top
 * sheet first. "Stay" on any of them stops there and nothing closes.
 */
export function confirmDiscardAll(ids: string[], next: () => void) {
  const confirms = ids.flatMap(id => [...(guards.get(id) ?? [])])
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
