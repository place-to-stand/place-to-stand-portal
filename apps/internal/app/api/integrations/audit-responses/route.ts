import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import {
  auditPayloadSchema,
  toAuditSubmissionRow,
} from '@/lib/form-submissions/audit-payload'
import { recordSubmission } from '@/lib/form-submissions/delivery/intake'
import { resolveDeliveryRequest } from '@/lib/form-submissions/delivery/request'

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
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  const parsed = auditPayloadSchema.safeParse(json)

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid payload.',
      },
      { status: 400 }
    )
  }

  try {
    // Email is only ever owed for a captured lead. Anything else asking for
    // delivery is ignored rather than rejected, so a confused caller still
    // gets its row recorded.
    const deliver =
      parsed.data.deliver &&
      parsed.data.status === 'captured' &&
      parsed.data.lead !== null

    const deliveryRequestedAt = await resolveDeliveryRequest({
      deliver,
      email: parsed.data.lead?.email,
      sessionKey: parsed.data.sessionId,
    })

    const recorded = await recordSubmission(
      toAuditSubmissionRow(
        parsed.data,
        request.headers.get('user-agent'),
        deliveryRequestedAt
      ),
      { deliver }
    )

    return NextResponse.json({ ok: true, data: recorded }, { status: 200 })
  } catch (error) {
    console.error('Failed to record audit submission', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to record submission.' },
      { status: 500 }
    )
  }
}
