import { BADGE_TINTS, type BadgeTint } from './badge-tints'

/**
 * The one map of status colours, shared by the internal and client portals so
 * a record reads the same in both. Labels stay with each app, because the
 * client portal words some states its own way ("Due").
 */
/** Each task status's hue: its badge and its board lane share it. */
export const TASK_STATUS_HUES = {
  ON_DECK: 'sky',
  IN_PROGRESS: 'emerald',
  BLOCKED: 'amber',
  DONE: 'neutral',
  ACCEPTED: 'neutral',
  ARCHIVED: 'neutral',
} as const satisfies Record<string, BadgeTint>

export const TASK_STATUS_TINTS = {
  ON_DECK: BADGE_TINTS[TASK_STATUS_HUES.ON_DECK],
  IN_PROGRESS: BADGE_TINTS[TASK_STATUS_HUES.IN_PROGRESS],
  BLOCKED: BADGE_TINTS[TASK_STATUS_HUES.BLOCKED],
  DONE: BADGE_TINTS[TASK_STATUS_HUES.DONE],
  ACCEPTED: BADGE_TINTS[TASK_STATUS_HUES.ACCEPTED],
  ARCHIVED: BADGE_TINTS[TASK_STATUS_HUES.ARCHIVED],
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
