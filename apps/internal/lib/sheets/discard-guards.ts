/**
 * Open sheets with unsaved changes, by stack id (`SheetStackItem.id`).
 * Going back to a sheet lower in the stack closes the sheets above it, and
 * each one with unsaved changes asks first, as its own Close would.
 */

type Confirm = (next: () => void, stay?: () => void) => void

type Guard = {
  confirm: Confirm
  /**
   * Work that saves on its own click inside a sheet (a comment, a lead
   * update), outside the sheet's Save. The sheet's own close asks it too.
   */
  draft: boolean
}

// A set per sheet: a dialog inside a sheet (emailing an invoice) or a draft
// comment guards its own unsaved work under the same id.
const guards = new Map<string, Set<Guard>>()

/**
 * The page's own form (`PageForm`) while it has unsaved changes. Leaving the
 * page (the Ctrl K palette) asks it after the open sheets.
 */
export const PAGE_FORM_GUARD_ID = 'page-form'

/** Called by a sheet while it has unsaved changes. Returns the unregister. */
export function registerDiscardGuard(
  id: string,
  confirm: Confirm,
  options: { draft?: boolean } = {}
) {
  const set = guards.get(id) ?? new Set<Guard>()
  const guard: Guard = { confirm, draft: options.draft ?? false }
  set.add(guard)
  guards.set(id, set)
  return () => {
    set.delete(guard)
    if (set.size === 0 && guards.get(id) === set) {
      guards.delete(id)
    }
  }
}

/**
 * Runs `next` once every listed sheet's unsaved changes are dealt with, top
 * sheet first. "Stay" on any of them stops there, nothing closes and `stay`
 * runs.
 */
export function confirmDiscardAll(
  ids: string[],
  next: () => void,
  stay?: () => void
) {
  const confirms = ids.flatMap(id =>
    [...(guards.get(id) ?? [])].map(guard => guard.confirm)
  )
  runInTurn(confirms, next, stay)
}

/**
 * Runs `next` once the drafts inside one sheet (comments, lead updates) are
 * dealt with: the sheet's own close asks them before its form.
 */
export function confirmDiscardDrafts(
  id: string | null | undefined,
  next: () => void,
  stay?: () => void
) {
  const confirms = id
    ? [...(guards.get(id) ?? [])]
        .filter(guard => guard.draft)
        .map(guard => guard.confirm)
    : []
  runInTurn(confirms, next, stay)
}

function runInTurn(confirms: Confirm[], next: () => void, stay?: () => void) {
  const run = (index: number) => {
    const confirm = confirms[index]
    if (confirm) {
      confirm(() => run(index + 1), stay)
    } else {
      next()
    }
  }
  run(0)
}

/** True while any sheet or page form holds unsaved changes. */
export function hasUnsavedChanges() {
  return guards.size > 0
}
