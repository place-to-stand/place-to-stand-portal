import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { syncTranscriptsForUser } from '@/lib/transcripts/sync'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  assertAdmin(user)

  const result = await syncTranscriptsForUser(user.id)

  return NextResponse.json({ ok: true, ...result })
}
