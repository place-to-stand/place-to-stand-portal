import type { BadgeTint } from '@pts/ui/badge-tints'
import {
  TASK_STATUS_HUES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TINTS as TASK_STATUS_TOKENS,
} from '@pts/ui/status-tints'

// Display vocabulary, not the DB enum: ACCEPTED (accepted_at set) and
// ARCHIVED (deleted_at set) are derived states with no task_status value.
type TaskStatusValue = keyof typeof TASK_STATUS_TOKENS

export function getTaskStatusToken(value: string): string {
  const normalized = value.toUpperCase() as TaskStatusValue
  if (normalized in TASK_STATUS_TOKENS) {
    return TASK_STATUS_TOKENS[normalized]
  }

  return 'border border-border bg-accent text-accent-foreground'
}

/** The status's hue (shared by its badge and its board lane); neutral if unknown. */
export function getTaskStatusHue(value: string): BadgeTint {
  const normalized = value.toUpperCase() as TaskStatusValue
  return normalized in TASK_STATUS_HUES
    ? TASK_STATUS_HUES[normalized]
    : 'neutral'
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

export { resolveTaskStatusStamps } from './task-status-stamps'

export { TASK_STATUS_TOKENS }
