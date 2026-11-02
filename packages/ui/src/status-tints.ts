import { BADGE_TINTS } from './badge-tints'

/**
 * The one map of status colours, shared by the internal and client portals so
 * a record reads the same in both. Labels stay with each app, because the
 * client portal words some states its own way ("Due").
 */
export const TASK_STATUS_TINTS = {
  ON_DECK: BADGE_TINTS.sky,
  IN_PROGRESS: BADGE_TINTS.emerald,
  BLOCKED: BADGE_TINTS.amber,
  DONE: BADGE_TINTS.neutral,
  ACCEPTED: BADGE_TINTS.neutral,
  ARCHIVED: BADGE_TINTS.neutral,
} as const

export const TASK_STATUS_LABELS = {
  ON_DECK: 'On deck',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  ACCEPTED: 'Accepted',
  ARCHIVED: 'Archived',
} as const

/** Void is neutral: a resting state, not an error. */
export const INVOICE_STATUS_TINTS = {
  DRAFT: BADGE_TINTS.neutral,
  SENT: BADGE_TINTS.sky,
  VIEWED: BADGE_TINTS.indigo,
  PAID: BADGE_TINTS.emerald,
  VOID: BADGE_TINTS.neutral,
} as const

/** Look up a tint by status, falling back to neutral. */
export function statusTint(
  tints: Readonly<Record<string, string>>,
  status: string
): string {
  return tints[status.toUpperCase()] ?? BADGE_TINTS.neutral
}
