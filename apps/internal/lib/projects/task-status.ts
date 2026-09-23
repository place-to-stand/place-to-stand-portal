import { BADGE_TINTS } from '@pts/ui/badge-tints'

// Display vocabulary, not the DB enum: ACCEPTED (accepted_at set) and
// ARCHIVED (deleted_at set) are derived states with no task_status value.
const TASK_STATUS_TOKENS = {
  ON_DECK: BADGE_TINTS.sky,
  IN_PROGRESS: BADGE_TINTS.emerald,
  BLOCKED: BADGE_TINTS.amber,
  DONE: BADGE_TINTS.neutral,
  ACCEPTED: BADGE_TINTS.neutral,
  ARCHIVED: BADGE_TINTS.neutral,
} as const

const TASK_STATUS_LABELS = {
  ON_DECK: 'On deck',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  ACCEPTED: 'Accepted',
  ARCHIVED: 'Archived',
} as const

type TaskStatusValue = keyof typeof TASK_STATUS_TOKENS

export function getTaskStatusToken(value: string): string {
  const normalized = value.toUpperCase() as TaskStatusValue
  if (normalized in TASK_STATUS_TOKENS) {
    return TASK_STATUS_TOKENS[normalized]
  }

  return 'border border-border bg-accent text-accent-foreground'
}

export function getTaskStatusLabel(value: string): string {
  const normalized = value.toUpperCase() as TaskStatusValue
  if (normalized in TASK_STATUS_LABELS) {
    return TASK_STATUS_LABELS[normalized]
  }

  const humanized = value.replace(/_/g, ' ').trim()

  if (!humanized) {
    return 'Unknown'
  }

  const lower = humanized.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Statuses that mean the task is not finished — reaching one reopens it. */
const REOPENING_STATUSES = new Set(['ON_DECK', 'IN_PROGRESS', 'BLOCKED'])

/**
 * The single rule for `tasks.completed_at`, shared by every status write path
 * (task sheet save, board status change, and both reorder routes). Callers
 * spread the result into their `.set({...})`.
 *
 * - Entering DONE stamps the moment.
 * - Staying DONE preserves the original stamp, so editing a finished task
 *   doesn't reset its clock — the whole reason this column exists instead of
 *   reading `updated_at`.
 * - Reopening to an active status clears it.
 * - Any other value (defensive: nothing else exists today) preserves it.
 */
export function resolveCompletedAt(
  nextStatus: string,
  currentCompletedAt: string | null | undefined
): { completedAt: string | null } {
  if (nextStatus === 'DONE') {
    return { completedAt: currentCompletedAt ?? new Date().toISOString() }
  }

  if (REOPENING_STATUSES.has(nextStatus)) {
    return { completedAt: null }
  }

  return { completedAt: currentCompletedAt ?? null }
}

export { TASK_STATUS_TOKENS }
