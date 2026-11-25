import type { FeedbackType } from './constants'

/** The list's state filter. */
export const FEEDBACK_STATES = ['new', 'task', 'spam', 'not_spam'] as const
export type FeedbackState = (typeof FEEDBACK_STATES)[number]

/** One report as the triage list, its sheet and a project's tab show it. */
export type FeedbackReportRecord = {
  id: string
  type: FeedbackType
  message: string
  pageUrl: string | null
  pageTitle: string | null
  screenshotPath: string | null
  screenshotMimeType: string | null
  screenshotSize: number | null
  reporterUserId: string | null
  reporterName: string | null
  reporterEmail: string | null
  origin: string | null
  userAgent: string | null
  viewport: string | null
  language: string | null
  timezone: string | null
  posthogReplayUrl: string | null
  spamReason: string | null
  taskId: string | null
  taskTitle: string | null
  taskArchived: boolean
  acknowledgedAt: string | null
  createdAt: string
  deletedAt: string | null
  projectId: string
  projectName: string
  projectSlug: string | null
  projectType: string
  clientName: string | null
  clientSlug: string | null
}
