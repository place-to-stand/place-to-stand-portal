import { and, desc, eq, isNull, or, isNotNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { meetings } from '@/lib/db/schema'
import { getTranscriptsForLead } from '@/lib/queries/transcripts'

type RouteParams = { params: Promise<{ leadId: string }> }

/**
 * GET /api/leads/[leadId]/transcripts
 * Fetch meetings with transcripts AND classified transcripts for a specific lead.
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  assertAdmin(user)

  const { leadId } = await params

  const [meetingsWithTranscripts, classifiedTranscripts] = await Promise.all([
    // Existing: meetings that have transcripts
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        endsAt: meetings.endsAt,
        transcriptStatus: meetings.transcriptStatus,
        transcriptText: meetings.transcriptText,
        transcriptFetchedAt: meetings.transcriptFetchedAt,
        conferenceId: meetings.conferenceId,
      })
      .from(meetings)
      .where(
        and(
          eq(meetings.leadId, leadId),
          isNull(meetings.deletedAt),
          or(
            isNotNull(meetings.conferenceId),
            isNotNull(meetings.transcriptText),
            isNotNull(meetings.transcriptFileId)
          )
        )
      )
      .orderBy(desc(meetings.startsAt)),
    // New: classified transcripts from the transcripts table
    getTranscriptsForLead(leadId),
  ])

  return NextResponse.json({
    meetings: meetingsWithTranscripts,
    transcripts: classifiedTranscripts,
  })
}
