import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { sendTaskDueDigests } from '@/lib/tasks/due-digest'

/**
 * Weekday-morning Vercel Cron (see vercel.json): emails each person their
 * late and due-today tasks. See `lib/tasks/due-digest.ts` for who gets what.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when the CRON_SECRET env var is set on the project.
 */
export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')

  if (authFailure) {
    return authFailure
  }

  try {
    const result = await sendTaskDueDigests()
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error('Failed to send task due digests', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to send task due digests.' },
      { status: 500 }
    )
  }
}
