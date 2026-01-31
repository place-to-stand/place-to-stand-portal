import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { fetchMeetingById } from '@/lib/queries/meetings'
import { syncMeetingTranscript } from '@/lib/google/transcript-sync'

type RouteParams = { params: Promise<{ meetingId: string }> }

/**
 * POST /api/meetings/[meetingId]/sync-transcript
 * Manually trigger transcript sync for a specific meeting.
 */
export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  assertAdmin(user)

  const { meetingId } = await params

  // Fetch the meeting
  const meeting = await fetchMeetingById(meetingId)

  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  if (!meeting.conferenceId) {
    return NextResponse.json(
      { error: 'Meeting does not have a Google Meet conference ID' },
      { status: 400 }
    )
  }

  // Sync the transcript
  const result = await syncMeetingTranscript(user.id, meeting)

  return NextResponse.json(result)
}
