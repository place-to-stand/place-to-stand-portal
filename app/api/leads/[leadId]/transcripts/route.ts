import { and, desc, eq, isNull, or, isNotNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { meetings } from '@/lib/db/schema'

type RouteParams = { params: Promise<{ leadId: string }> }

/**
 * GET /api/leads/[leadId]/transcripts
 * Fetch meetings with transcripts for a specific lead.
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

  // Fetch meetings that have transcripts (status = FETCHED)
  const meetingsWithTranscripts = await db
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
        // Include meetings with transcripts OR meetings that might have them
        or(
          isNotNull(meetings.conferenceId),
          isNotNull(meetings.transcriptText),
          isNotNull(meetings.transcriptFileId)
        )
      )
    )
    .orderBy(desc(meetings.startsAt))

  return NextResponse.json({ meetings: meetingsWithTranscripts })
}
