/**
 * The My Tasks Done column shows a rolling window rather than every task ever
 * finished. These helpers are shared by the server page that resolves the
 * window and the client control that widens it, so they deliberately live
 * outside `lib/data/tasks.ts` — that module is `server-only`.
 */

/** Two weeks per step, matching the board's "load previous two weeks". */
export const DONE_WINDOW_WEEKS = 2

/** Ten years of two-week steps — far past any real board, but bounded. */
export const MAX_DONE_WEEKS = 520

/**
 * Start of the Done window, `weeks` back from now, as an ISO instant.
 */
export function resolveDoneWindowStart(weeks: number): string {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)
  return cutoff.toISOString()
}

/**
 * Clamp an untrusted `?doneWeeks=` value to a usable window width. Anything
 * malformed, negative, or narrower than one step falls back to one step.
 */
export function parseDoneWeeks(value: string | undefined): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < DONE_WINDOW_WEEKS) {
    return DONE_WINDOW_WEEKS
  }

  return Math.min(parsed, MAX_DONE_WEEKS)
}
