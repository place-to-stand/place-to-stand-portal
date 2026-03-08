import { NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { syncTranscriptsForUser } from '@/lib/transcripts/sync'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const user = await requireUser()

  const full = request.nextUrl.searchParams.get('full') === '1'

  const result = await syncTranscriptsForUser(user.id, { full })

  return NextResponse.json({ ok: true, ...result })
}
