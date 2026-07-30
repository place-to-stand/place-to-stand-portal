import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  auditPayloadSchema,
  toAuditSubmissionRow,
} from '@/lib/form-submissions/audit-payload'
import { upsertFormSubmission } from '@/lib/queries/form-submissions'

/**
 * Opportunity Audit progress intake from the marketing site.
 *
 * Called repeatedly for a single audit session as the visitor progresses, and
 * once more from a `pagehide` beacon. Ordering and idempotency are handled in
 * `upsertFormSubmission`; see docs/integrations/marketing-form-submissions.md.
 *
 * Deliberately does NOT call `revalidatePath`: these beacons fire constantly,
 * and /submissions renders dynamically anyway (cookie-based auth + searchParams).
 */
export async function POST(request: NextRequest) {
  const authFailure = verifyIntakeToken(
    request,
    serverEnv.AUDIT_INTAKE_TOKEN,
    'Audit'
  )

  if (authFailure) {
    return authFailure
  }

  let json: unknown

  try {
    json = await request.json()
  } catch (error) {
    console.error('Invalid JSON body for audit intake', error)
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = auditPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
      { status: 400 }
    )
  }

  try {
    await upsertFormSubmission(
      toAuditSubmissionRow(parsed.data, request.headers.get('user-agent'))
    )
  } catch (error) {
    console.error('Failed to record audit submission', error)
    return NextResponse.json(
      { error: 'Unable to record submission.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
