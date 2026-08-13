/**
 * The My Tasks Done column shows a rolling window rather than every task ever
 * finished. The window is client state on the board -- it's a quick look-up,
 * not a view worth putting in the URL -- so these helpers are plain functions
 * with no server dependency.
 */

/** Two weeks per step, matching the board's "load previous two weeks". */
export const DONE_WINDOW_WEEKS = 2

/** Ten years of two-week steps — far past any real board, but bounded. */
export const MAX_DONE_WEEKS = 520

/**
 * Start of the Done window, `weeks` back from `now`, as an ISO instant.
 *
 * `now` is passed in rather than read here so the board's first client render
 * matches the server's: deriving it from `new Date()` during render would give
 * SSR and hydration two different cutoffs, and a task completed near the
 * boundary would flip in or out between them.
 */
export function resolveDoneWindowStart(weeks: number, now: string): string {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)
  return cutoff.toISOString()
}

/**
 * Human label for the current window width, for the footer's explanation of
 * why the column isn't showing everything.
 */
export function formatDoneWindowLabel(weeks: number): string {
  if (weeks % 52 === 0) {
    const years = weeks / 52
    return years === 1 ? 'a year' : `${years} years`
  }

  if (weeks >= 8 && weeks % 4 === 0) {
    const months = weeks / 4
    return months === 1 ? 'a month' : `${months} months`
  }

  return `${weeks} weeks`
}
