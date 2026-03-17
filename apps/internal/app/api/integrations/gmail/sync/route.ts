import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { syncGmailForUser } from '@/lib/email/sync'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const user = await requireUser()

  const full = request.nextUrl.searchParams.get('full') === '1'

  try {
    const result = await syncGmailForUser(user.id, { full })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
