import { firstParam, type RawSearchParams } from '@/lib/pagination/params'

import { isFeedbackType } from './constants'
import { FEEDBACK_STATES, type FeedbackState } from './types'

export function isFeedbackState(value: unknown): value is FeedbackState {
  return (
    typeof value === 'string' &&
    (FEEDBACK_STATES as readonly string[]).includes(value)
  )
}

/** The Feedback list's filters, read from its URL. */
export function parseFeedbackListParams(params: RawSearchParams) {
  const type = firstParam(params.type)
  const state = firstParam(params.state)
  return {
    page: Math.max(1, Number.parseInt(firstParam(params.page) ?? '1', 10) || 1),
    type: isFeedbackType(type) ? type : undefined,
    state: isFeedbackState(state) ? state : undefined,
    search: firstParam(params.q)?.trim() || undefined,
  }
}
