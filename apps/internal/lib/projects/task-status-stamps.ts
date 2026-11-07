/** Statuses that mean the task is not finished — reaching one reopens it. */
const REOPENING_STATUSES = new Set(['ON_DECK', 'IN_PROGRESS', 'BLOCKED'])

export type TaskStatusStamps = {
  completedAt: string | null
  /** Present only when the write must clear acceptance. */
  acceptedAt?: null
}

/**
 * The single rule for a task's status stamps, shared by every status write
 * path (task sheet save, CLI/MCP, board status change, the reorder route and
 * create). Callers spread the result into their `.set({...})`.
 *
 * `completed_at`:
 * - Entering DONE stamps the moment.
 * - Staying DONE preserves the original stamp, so editing a finished task
 *   doesn't reset its clock — the whole reason this column exists instead of
 *   reading `updated_at`.
 * - Reopening to an active status clears it.
 * - Any other value (defensive: nothing else exists today) preserves it.
 *
 * `accepted_at` only means something on a DONE task, so reopening clears it.
 * Left set, a reopened task would drop off My Tasks and due-date alerts (both
 * hide accepted tasks) and skip review when it is marked Done again.
 */
export function resolveTaskStatusStamps(
  nextStatus: string,
  currentCompletedAt: string | null | undefined
): TaskStatusStamps {
  if (nextStatus === 'DONE') {
    return { completedAt: currentCompletedAt ?? new Date().toISOString() }
  }

  if (REOPENING_STATUSES.has(nextStatus)) {
    return { completedAt: null, acceptedAt: null }
  }

  return { completedAt: currentCompletedAt ?? null }
}
