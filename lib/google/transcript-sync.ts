import 'server-only'

import {
  fetchMeetingsNeedingTranscriptSync,
  updateMeeting,
  type Meeting,
} from '@/lib/queries/meetings'
import { fetchFormattedTranscript, fetchGeminiMeetingNotes } from './meet'
import { shareWithDomain } from './docs'

// Domain to share transcript docs with (all team members)
const TEAM_DOMAIN = 'placetostandagency.com'

export type TranscriptSyncResult = {
  meetingId: string
  status: 'success' | 'not_ready' | 'no_transcript' | 'error'
  error?: string
}

/**
 * Sync transcript for a single meeting.
 * Returns the sync result.
 */
export async function syncMeetingTranscript(
  userId: string,
  meeting: Meeting,
  options?: { connectionId?: string }
): Promise<TranscriptSyncResult> {
  console.log(`[Transcript Sync] Starting sync for meeting ${meeting.id}`)
  console.log(`[Transcript Sync] Meeting title: "${meeting.title}"`)
  console.log(`[Transcript Sync] Conference ID: ${meeting.conferenceId}`)

  if (!meeting.conferenceId) {
    console.log('[Transcript Sync] No conference ID on meeting')
    return {
      meetingId: meeting.id,
      status: 'no_transcript',
      error: 'Meeting has no conference ID',
    }
  }

  try {
    // Try to fetch the transcript via Meet API first
    const result = await fetchFormattedTranscript(
      userId,
      meeting.conferenceId,
      options
    )

    if (result) {
      // Meet API transcript found - save it
      console.log('[Transcript Sync] Found Meet API transcript')
      const now = new Date().toISOString()
      await updateMeeting(meeting.id, {
        conferenceRecordId: result.conferenceRecordId,
        transcriptText: result.text,
        transcriptStatus: 'FETCHED',
        transcriptFetchedAt: now,
      })

      return {
        meetingId: meeting.id,
        status: 'success',
      }
    }

    // Meet API didn't return a transcript - try Gemini Notes from Drive
    console.log('[Transcript Sync] No Meet API transcript, trying Gemini Notes...')
    const meetingDate = new Date(meeting.startsAt)
    const geminiNotes = await fetchGeminiMeetingNotes(
      userId,
      meeting.title,
      meetingDate,
      options
    )

    if (geminiNotes) {
      // Gemini notes found - save them
      console.log('[Transcript Sync] Found Gemini Notes')
      const now = new Date().toISOString()
      await updateMeeting(meeting.id, {
        transcriptText: geminiNotes.text,
        transcriptFileId: geminiNotes.docId,
        transcriptStatus: 'FETCHED',
        transcriptFetchedAt: now,
      })

      // Share the transcript doc with the team domain
      // This allows all team members to access it regardless of who synced it
      try {
        await shareWithDomain(userId, {
          docId: geminiNotes.docId,
          domain: TEAM_DOMAIN,
          role: 'reader',
        }, options)
      } catch (shareError) {
        // Log but don't fail - transcript is still useful even if sharing fails
        console.error('[Transcript Sync] Failed to share with domain:', shareError)
      }

      return {
        meetingId: meeting.id,
        status: 'success',
      }
    }

    // No transcript from either source
    console.log('[Transcript Sync] No transcript found from Meet API or Gemini Notes')
    const meetingEndTime = new Date(meeting.endsAt)
    const hoursSinceEnd = (Date.now() - meetingEndTime.getTime()) / (1000 * 60 * 60)

    // If more than 24 hours since meeting ended and still no transcript,
    // mark as NOT_RECORDED
    if (hoursSinceEnd > 24) {
      await updateMeeting(meeting.id, {
        transcriptStatus: 'NOT_RECORDED',
      })
      return {
        meetingId: meeting.id,
        status: 'no_transcript',
      }
    }

    // Otherwise, mark as PROCESSING (still waiting)
    if (meeting.transcriptStatus === 'PENDING') {
      await updateMeeting(meeting.id, {
        transcriptStatus: 'PROCESSING',
      })
    }

    return {
      meetingId: meeting.id,
      status: 'not_ready',
    }
  } catch (error) {
    console.error(`Failed to sync transcript for meeting ${meeting.id}:`, error)

    // Mark as failed
    await updateMeeting(meeting.id, {
      transcriptStatus: 'FAILED',
    })

    return {
      meetingId: meeting.id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync transcripts for all meetings that need it.
 * This should be called from a background job.
 */
export async function syncAllPendingTranscripts(
  userId: string,
  options?: { connectionId?: string }
): Promise<TranscriptSyncResult[]> {
  const meetings = await fetchMeetingsNeedingTranscriptSync()
  const results: TranscriptSyncResult[] = []

  for (const meeting of meetings) {
    const result = await syncMeetingTranscript(userId, meeting, options)
    results.push(result)

    // Add a small delay between API calls to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return results
}
