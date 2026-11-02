import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { addToMarketingAudience } from '@/lib/form-submissions/delivery/audience'
import { recordSubmission } from '@/lib/form-submissions/delivery/intake'
import {
  subscribePayloadSchema,
  toSubscribeSubmissionRow,
} from '@/lib/form-submissions/subscribe-payload'

/**
 * Blog/mailing-list signup intake from the marketing site.
 *
 * One-shot like the contact form, and idempotent on `submissionId` through the
 * same upsert path. A new signup is added to the Resend marketing audience
 * (submitting the form is the consent); a replay is not. No team notification
 * or confirmation email is sent.
 *
 * See docs/integrations/marketing-form-submissions.md.
 */
export async function POST(request: NextRequest) {
  const authFailure = verifyIntakeToken(
    request,
    serverEnv.SUBSCRIBE_INTAKE_TOKEN,
    'Subscribe'
  )

  if (authFailure) {
    return authFailure
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for subscribe intake', error)
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  const parsed = subscribePayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid payload.',
      },
      { status: 400 }
    )
  }

  const { email } = parsed.data.subscriber

  try {
    const recorded = await recordSubmission(
      toSubscribeSubmissionRow(parsed.data, request.headers.get('user-agent')),
      {
        deliver: false,
        // Best-effort and never throws (see audience.ts).
        onInserted: () => addToMarketingAudience({ email, name: null }),
      }
    )

    return NextResponse.json({ ok: true, data: recorded }, { status: 200 })
  } catch (error) {
    console.error('Failed to record subscribe submission', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to record submission.' },
      { status: 500 }
    )
  }
}
