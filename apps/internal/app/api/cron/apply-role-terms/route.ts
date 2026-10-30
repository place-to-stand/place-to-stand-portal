import { NextResponse, type NextRequest } from 'next/server'

import { serverEnv } from '@/lib/env.server'
import { verifyIntakeToken } from '@/lib/integrations/verify-intake-token'
import { applyDueRoleTerms } from '@/lib/settings/users/services/role'

/**
 * Daily Vercel Cron (see vercel.json): a role change an admin dated next
 * month leaves `users.role` alone until then. On the first of the month
 * this brings every such sign-in's role (and staff-company membership) up
 * to the term now in force. Signing in does the same for that person.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: NextRequest) {
  const authFailure = verifyIntakeToken(request, serverEnv.CRON_SECRET, 'Cron')
  if (authFailure) return authFailure

  try {
    const changes = await applyDueRoleTerms()
    if (changes.length > 0) {
      console.log(`Applied ${changes.length} scheduled role change(s)`)
    }
    return NextResponse.json({ ok: true, data: { applied: changes.length } })
  } catch (error) {
    console.error('Failed to apply scheduled role changes', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to apply scheduled role changes.' },
      { status: 500 }
    )
  }
}
