/**
 * Feedback reports: what the widget on a project's website sends in, and what
 * the Feedback triage list shows. Shared by the intake endpoint, the list and
 * the project's Feedback tab.
 */

export const FEEDBACK_TYPES = ['bug', 'request', 'question'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  request: 'Request',
  question: 'Question',
}

export function isFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === 'string' &&
    (FEEDBACK_TYPES as readonly string[]).includes(value)
  )
}

/** Caps on what one report may carry. The endpoint is public. */
export const FEEDBACK_LIMITS = {
  message: 5000,
  name: 200,
  email: 320,
  url: 2000,
  title: 300,
  /** Viewport, language, time zone, PostHog session id. */
  short: 200,
  userAgent: 500,
  /** One screenshot image. */
  screenshotBytes: 2 * 1024 * 1024,
  /** The whole request, screenshot included. */
  requestBytes: 3 * 1024 * 1024,
  /** Websites one project may list. */
  origins: 20,
} as const

/**
 * Rate limits for reports from visitors (signed-in portal users skip them).
 * Counted in `rate_limit_buckets`, the same table that throttles sign-in
 * emails, so nothing new runs.
 */
export const FEEDBACK_RATE_LIMITS = {
  windowSeconds: 60 * 60,
  /** Reports one visitor (by IP) may send in the window, across projects. */
  perIp: 10,
  /** Reports one project may take in the window from all visitors. */
  perProject: 60,
} as const

/** Folder for screenshots in the task-attachments bucket. */
export const FEEDBACK_SCREENSHOT_PREFIX = 'feedback'
