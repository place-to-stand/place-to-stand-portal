import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  contactPayloadSchema,
  toContactSubmissionRow,
} from '@/lib/form-submissions/contact-payload'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

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
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = contactPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    )
  }

  try {
    await upsertFormSubmission(
      toContactSubmissionRow(parsed.data, request.headers.get('user-agent'))
    )
  } catch (error) {
    console.error('Failed to record contact submission', error)
    return NextResponse.json(
      { error: 'Unable to record submission.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
