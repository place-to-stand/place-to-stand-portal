import { BADGE_TINTS } from '@pts/ui/badge-tints'

/**
 * Client-facing subset of the internal app's task status presentation
 * (`apps/internal/lib/projects/task-status.ts`). ARCHIVED is intentionally
 * absent — archived tasks are never surfaced in the portal.
 */
const TASK_STATUS_LABELS = {
  ON_DECK: 'On deck',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
} as const

const TASK_STATUS_TOKENS = {
  ON_DECK: BADGE_TINTS.sky,
  IN_PROGRESS: BADGE_TINTS.emerald,
  BLOCKED: BADGE_TINTS.amber,
  DONE: BADGE_TINTS.neutral,
} as const

type ClientTaskStatus = keyof typeof TASK_STATUS_LABELS

export function getTaskStatusLabel(value: string): string {
  return value in TASK_STATUS_LABELS
    ? TASK_STATUS_LABELS[value as ClientTaskStatus]
    : value
}

export function getTaskStatusToken(value: string): string {
  return value in TASK_STATUS_TOKENS
    ? TASK_STATUS_TOKENS[value as ClientTaskStatus]
    : BADGE_TINTS.neutral
}
