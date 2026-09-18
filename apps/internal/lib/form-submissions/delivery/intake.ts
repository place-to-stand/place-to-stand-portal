import 'server-only'

import type { NewFormSubmission } from '@pts/db/types'

import { submissionReceivedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { findDeliveryStateBySessionKey } from '@/lib/queries/form-submission-delivery'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

import {
  deliverSubmissionEmails,
  SKIPPED_OUTCOMES,
  type SubmissionEmailOutcomes,
} from './deliver'

export type RecordedSubmission = {
  /** Null when the upsert was a no-op and no row exists for the session. */
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

  // A no-op upsert (an older replay, or a tombstone) still names a row. When
  // delivery was asked for, flush whatever that row still owes: a retried
  // submit must never leave the earlier request's emails stranded.
  const id =
    result?.id ??
    (deliver ? (await findDeliveryStateBySessionKey(row.sessionKey))?.id : null)

  if (!id) {
    return { id: null, emails: SKIPPED_OUTCOMES }
  }

  // Only the first insert is an event; later beacons for the same session
  // are updates and would otherwise flood the feed.
  if (result?.inserted) {
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

  if (!deliver) {
    return { id, emails: SKIPPED_OUTCOMES }
  }

  // Asked for by the payload, decided by the row (`delivery_requested_at`).
  // Nothing in here may fail the request: the row is stored, so any failure
  // past this point is a delayed email the sweep will retry, not a lost lead.
  try {
    return { id, emails: await deliverSubmissionEmails(id) }
  } catch (error) {
    console.error('Submission email delivery failed after recording', {
      id,
      error,
    })
    return { id, emails: { team: 'queued', confirmation: 'queued' } }
  }
}
