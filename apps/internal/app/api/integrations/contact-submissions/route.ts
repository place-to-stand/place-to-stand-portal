import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  contactPayloadSchema,
  toContactSubmissionRow,
} from '@/lib/form-submissions/contact-payload'
import { recordSubmission } from '@/lib/form-submissions/delivery/intake'
import { resolveDeliveryRequest } from '@/lib/form-submissions/delivery/request'
import { detectContactSpam } from '@/lib/form-submissions/spam'

/**
 * Contact form intake from the marketing site.
 *
 * One-shot: the submission arrives complete and is never updated. It shares
 * the upsert path with the audit intake purely for idempotency — a retry with
 * the same `submissionId` is a no-op rather than a duplicate row.
 *
 * See docs/integrations/marketing-form-submissions.md.
 */
export async function POST(request: NextRequest) {
  const authFailure = verifyIntakeToken(
    request,
    serverEnv.CONTACT_INTAKE_TOKEN,
    // oxlint-disable-next-line pts/copy -- the website's contact form
    'Contact'
  )

  if (authFailure) {
    return authFailure
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for contact intake', error)
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  const parsed = contactPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid payload.',
      },
      { status: 400 }
    )
  }

  // Spam is still recorded (and listed, with a Spam badge), but never
  // emailed: no team notification, no confirmation to the address it gave.
  const spamReason = detectContactSpam({
    subject: parsed.data.contact.subject,
    message: parsed.data.contact.message,
    bot: parsed.data.bot,
  })
  const deliver = parsed.data.deliver && spamReason === null

  if (spamReason) {
    console.warn('Contact submission flagged as spam', {
      submissionId: parsed.data.submissionId,
      spamReason,
    })
  }

  try {
    const deliveryRequestedAt = await resolveDeliveryRequest({
      deliver,
      email: parsed.data.contact.email,
      sessionKey: parsed.data.submissionId,
    })

    const recorded = await recordSubmission(
      toContactSubmissionRow(
        parsed.data,
        request.headers.get('user-agent'),
        deliveryRequestedAt,
        spamReason
      ),
      { deliver }
    )

    return NextResponse.json({ ok: true, data: recorded }, { status: 200 })
  } catch (error) {
    console.error('Failed to record contact submission', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to record submission.' },
      { status: 500 }
    )
  }
}
