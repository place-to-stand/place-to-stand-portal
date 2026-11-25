import 'server-only'

import type { AppUser } from '@/lib/auth/session'
import { FEEDBACK_TYPE_LABELS } from '@/lib/feedback/constants'
import type { FeedbackReportRecord } from '@/lib/feedback/types'

import { logActivity } from './logger'
import type { ActivityEvent } from './types'

/** Logs a feedback event on the report's project (best effort, like all logging). */
export async function logFeedbackActivity(
  user: Pick<AppUser, 'id' | 'role'>,
  report: Pick<
    FeedbackReportRecord,
    'id' | 'type' | 'projectId' | 'projectName' | 'companyId'
  >,
  eventFor: (args: {
    reportId: string
    typeLabel: string
    projectName: string
  }) => ActivityEvent
) {
  const event = eventFor({
    reportId: report.id,
    typeLabel: FEEDBACK_TYPE_LABELS[report.type],
    projectName: report.projectName,
  })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROJECT',
    targetId: report.projectId,
    targetProjectId: report.projectId,
    targetCompanyId: report.companyId,
    metadata: event.metadata,
  })
}
