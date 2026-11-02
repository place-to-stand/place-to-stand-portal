import {
  statusTint,
  TASK_STATUS_LABELS,
  TASK_STATUS_TINTS,
} from '@pts/ui/status-tints'

/**
 * Task status labels and colours, shared with the internal portal through
 * `@pts/ui/status-tints`. Archived tasks never reach the client portal.
 */

export function getTaskStatusLabel(value: string): string {
  return value in TASK_STATUS_LABELS
    ? TASK_STATUS_LABELS[value as keyof typeof TASK_STATUS_LABELS]
    : value
}

export function getTaskStatusToken(value: string): string {
  return statusTint(TASK_STATUS_TINTS, value)
}
