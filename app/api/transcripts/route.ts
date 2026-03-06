import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { listTranscripts, getTranscriptCounts } from '@/lib/queries/transcripts'

/**
 * GET /api/transcripts — List transcripts (content column excluded)
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  assertAdmin(user)

  const searchParams = request.nextUrl.searchParams
  const classification = searchParams.get('classification') ?? undefined
  const clientId = searchParams.get('clientId') ?? undefined
  const projectId = searchParams.get('projectId') ?? undefined
  const leadId = searchParams.get('leadId') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const [transcripts, counts] = await Promise.all([
    listTranscripts({ classification, clientId, projectId, leadId, search, limit, offset }),
    getTranscriptCounts(),
  ])

  return NextResponse.json({ ok: true, transcripts, counts })
}
