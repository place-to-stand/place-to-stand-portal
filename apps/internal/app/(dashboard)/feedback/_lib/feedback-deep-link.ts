import 'server-only'

import { redirect } from 'next/navigation'

import type { AppUser } from '@/lib/auth/session'
import { fetchFeedbackReportById } from '@/lib/data/feedback'
import { NotFoundError } from '@/lib/errors/http'
import type { FeedbackReportRecord } from '@/lib/feedback/types'
import { feedbackHref } from '@/lib/sheets/hrefs'
import { UUID_PATTERN } from '@pts/db/uuid'

/**
 * Resolves `?feedback=<id>` for the Feedback list or its archive, whichever
 * page the report is on, and moves to the other tab when it was archived or
 * restored since the link was made.
 */
export async function resolveFeedbackDeepLink(
  user: AppUser,
  idParam: string | undefined,
  tab: 'active' | 'archive'
): Promise<{ report: FeedbackReportRecord | null; notFound: boolean }> {
  if (!idParam) return { report: null, notFound: false }
  if (!UUID_PATTERN.test(idParam)) return { report: null, notFound: true }

  let report: FeedbackReportRecord
  try {
    report = await fetchFeedbackReportById(user, idParam)
  } catch (error) {
    if (error instanceof NotFoundError) return { report: null, notFound: true }
    throw error
  }

  const archived = report.deletedAt !== null
  if (archived && tab === 'active') {
    redirect(feedbackHref(report.id, { archived: true }))
  }
  if (!archived && tab === 'archive') redirect(feedbackHref(report.id))

  return { report, notFound: false }
}
