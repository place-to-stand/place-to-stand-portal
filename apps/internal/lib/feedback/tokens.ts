import { BADGE_TINTS } from '@placetostand/ui/badge-tints'

import type { FeedbackType } from './constants'

/** Type badges. Always paired with the text label. */
export const FEEDBACK_TYPE_TOKENS: Record<FeedbackType, string> = {
  bug: BADGE_TINTS.rose,
  request: BADGE_TINTS.sky,
  question: BADGE_TINTS.amber,
}

/** Where a report stands, shown in the list's State column. */
export const FEEDBACK_STATE_TOKENS = {
  new: BADGE_TINTS.violet,
  seen: BADGE_TINTS.neutral,
  task: BADGE_TINTS.emerald,
  spam: BADGE_TINTS.rose,
} as const

export const FEEDBACK_STATE_LABELS = {
  new: 'New',
  seen: 'Seen',
  task: 'Task',
  spam: 'Spam',
} as const

export type FeedbackRowState = keyof typeof FEEDBACK_STATE_LABELS

/** Spam first, then task, then new or seen. */
export function feedbackRowState(report: {
  spamReason: string | null
  taskId: string | null
  acknowledgedAt: string | null
}): FeedbackRowState {
  if (report.spamReason !== null) return 'spam'
  if (report.taskId !== null) return 'task'
  return report.acknowledgedAt === null ? 'new' : 'seen'
}
