import 'server-only'

import type { NewFormSubmission } from '@pts/db/types'

import { submissionReceivedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

import {
  deliverSubmissionEmails,
  type SubmissionEmailOutcomes,
} from './deliver'

export type RecordedSubmission = {
  /** Null when the upsert was a no-op (stale beacon or tombstoned session). */
  id: string | null
  emails: SubmissionEmailOutcomes
}

/**
 * The shared tail of both marketing intake routes: record, log, then send.
 *
 * Order is the point (PRD 008 §1). The row is written before any email is
 * attempted, so a Resend outage costs a delayed notification rather than a
 * lost lead, and nothing after the upsert can fail the request.
 *
 * Throws only when the upsert itself fails. The caller turns that into a 500,
 * which is the one failure the marketing site surfaces to the visitor.
 */
export async function recordSubmission(
  row: NewFormSubmission,
  { deliver }: { deliver: boolean }
): Promise<RecordedSubmission> {
  const result = await upsertFormSubmission(row)

  if (!result) {
    return { id: null, emails: { team: 'skipped', confirmation: 'skipped' } }
  }

  // Only the first insert is an event; later beacons for the same session
  // are updates and would otherwise flood the feed.
  if (result.inserted) {
    const event = submissionReceivedEvent({
      formType: result.kind,
      status: result.status,
    })

    try {
      await logActivity({
        actorId: null,
        source: 'SYSTEM',
        verb: event.verb,
        summary: event.summary,
        targetType: 'SUBMISSION',
        targetId: result.id,
        metadata: event.metadata,
      })
    } catch (error) {
      // The submission is already stored. An audit-trail hiccup must not turn
      // into a visitor-facing error now that the site waits on this response.
      console.error('Failed to log submission activity', error)
    }
  }

  // Asked for by the payload, decided by the row: a replay whose own request
  // was throttled still flushes whatever an earlier request left outstanding.
  const emails = deliver
    ? await deliverSubmissionEmails(result.id)
    : ({ team: 'skipped', confirmation: 'skipped' } as const)

  return { id: result.id, emails }
}
