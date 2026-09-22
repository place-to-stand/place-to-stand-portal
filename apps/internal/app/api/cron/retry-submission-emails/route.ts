import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { deliverSubmissionEmails } from '@/lib/form-submissions/delivery/deliver'
import { resolvePortalOrigin } from '@/lib/form-submissions/delivery/addresses'
import { STUCK_ALERT_AFTER_MINUTES } from '@/lib/form-submissions/delivery/constants'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { notifyStuckSubmissionEmails } from '@/lib/notifications/google-chat'
import {
  listSubmissionsAwaitingEmail,
  listSubmissionsStuckAtThreshold,
} from '@/lib/queries/form-submission-delivery'
import { submissionHref } from '@/lib/sheets/hrefs'

/**
 * Vercel Cron (see vercel.json): retries marketing form emails that failed to
 * send when the submission arrived.
 *
 * The intake routes record the row first and never fail on a Resend error, so
 * an outage leaves rows with delivery requested and a stamp still null. This
 * sweep is what makes "record first" safe rather than lossy. Rows that never
 * asked for delivery (everything before the PRD 008 cutover) are never
 * selected, so it cannot retro-email history. The window lives in
 * lib/form-submissions/delivery/constants.ts, shared with the sheet.
 *
 * Sequential on purpose: the batch is tiny, and it keeps a recovering Resend
 * from being hit with a burst.
 *
 * After retrying, anything still unsent an hour after it was requested is
 * posted to the Sales Google Chat space, once per row, so an outage becomes a
 * message in a channel someone reads rather than a null column nobody does.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
const BATCH_LIMIT = 25

export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  try {
    const ids = await listSubmissionsAwaitingEmail({ limit: BATCH_LIMIT })

    let stillQueued = 0

    for (const id of ids) {
      const outcome = await deliverSubmissionEmails(id)
      if (outcome.team === 'queued' || outcome.confirmation === 'queued') {
        stillQueued += 1
      }
    }

    if (ids.length > 0) {
      console.log(
        `Retried email for ${ids.length} submission(s); ${stillQueued} still queued`
      )
    }

    // Checked after the retries so a row that just went out is not reported.
    const stuck = await listSubmissionsStuckAtThreshold()

    if (stuck.length > 0) {
      const origin = resolvePortalOrigin()
      console.error(
        `${stuck.length} submission email(s) still unsent after ${STUCK_ALERT_AFTER_MINUTES} minutes`,
        stuck.map(row => row.id)
      )
      await notifyStuckSubmissionEmails({
        thresholdMinutes: STUCK_ALERT_AFTER_MINUTES,
        items: stuck.map(row => ({
          label: row.contactName || row.contactEmail || row.id,
          kind: row.kind,
          url: origin ? `${origin}${submissionHref(row.id)}` : null,
        })),
      })
    }

    return NextResponse.json({
      ok: true,
      data: { retriedCount: ids.length, stillQueued, stuckCount: stuck.length },
    })
  } catch (error) {
    console.error('Failed to retry submission emails', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to retry submission emails.' },
      { status: 500 }
    )
  }
}
