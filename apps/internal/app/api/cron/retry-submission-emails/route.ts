import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { deliverSubmissionEmails } from '@/lib/form-submissions/delivery/deliver'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { listSubmissionsAwaitingEmail } from '@/lib/queries/form-submission-delivery'

/**
 * Vercel Cron (see vercel.json): retries marketing form emails that failed to
 * send when the submission arrived.
 *
 * The intake routes record the row first and never fail on a Resend error, so
 * an outage leaves rows with delivery requested and a stamp still null. This
 * sweep is what makes "record first" safe rather than lossy. Rows that never
 * asked for delivery (everything before the PRD 008 cutover) are never
 * selected, so it cannot retro-email history.
 *
 * Sequential on purpose: the batch is tiny, and it keeps a recovering Resend
 * from being hit with a burst.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
const MIN_AGE_MINUTES = 5
const MAX_AGE_HOURS = 24
const BATCH_LIMIT = 25

export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  try {
    const ids = await listSubmissionsAwaitingEmail({
      minAgeMinutes: MIN_AGE_MINUTES,
      maxAgeHours: MAX_AGE_HOURS,
      limit: BATCH_LIMIT,
    })

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

    return NextResponse.json({
      ok: true,
      data: { retriedCount: ids.length, stillQueued },
    })
  } catch (error) {
    console.error('Failed to retry submission emails', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to retry submission emails.' },
      { status: 500 }
    )
  }
}
