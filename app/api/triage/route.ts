import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listThreadsForUser } from '@/lib/queries/threads'
import { listTranscripts } from '@/lib/queries/transcripts'
import { suggestClientMatch, suggestLeadMatch } from '@/lib/email/suggestions'

const DEFAULT_PAGE_SIZE = 50

/**
 * Triage queue: fetches unclassified emails + transcripts, interleaved by date.
 * Supports cursor-based pagination via `limit` and `cursor` (ISO date) params.
 */
export async function GET(request: Request) {
  const user = await requireUser()

  const { searchParams } = new URL(request.url)
  const typeFilter = searchParams.get('type') // 'email' | 'transcript' | null (all)
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 200)
  const cursor = searchParams.get('cursor') // ISO date string — fetch items older than this

  // Fetch `limit` items from each source (to properly interleave, we need candidates from both)
  const [emailThreads, transcriptRows] = await Promise.all([
    typeFilter === 'transcript'
      ? Promise.resolve([])
      : listThreadsForUser(user.id, {
          classificationFilter: 'UNCLASSIFIED',
          sentFilter: 'inbox',
          beforeDate: cursor ?? undefined,
          limit,
          offset: 0,
        }),
    typeFilter === 'email'
      ? Promise.resolve([])
      : listTranscripts({
          classification: 'UNCLASSIFIED',
          beforeDate: cursor ?? undefined,
          limit,
          offset: 0,
        }),
  ])

  // Run DB suggestions for emails (fast, per-request matching)
  const triageEmails = await Promise.all(
    emailThreads.map(async thread => {
      const [clientSuggestion, leadSuggestion] = await Promise.all([
        suggestClientMatch(thread.participantEmails),
        suggestLeadMatch(thread.participantEmails),
      ])

      return {
        itemType: 'email' as const,
        id: thread.id,
        sortDate: thread.lastMessageAt ?? thread.latestMessage?.sentAt ?? null,
        thread: { ...thread, clientSuggestion, leadSuggestion },
      }
    })
  )

  const triageTranscripts = transcriptRows.map(transcript => ({
    itemType: 'transcript' as const,
    id: transcript.id,
    sortDate: transcript.meetingDate ?? transcript.createdAt,
    transcript,
  }))

  // Merge and sort by date (newest first)
  const merged = [...triageEmails, ...triageTranscripts].sort((a, b) => {
    const dateA = a.sortDate ? new Date(a.sortDate).getTime() : 0
    const dateB = b.sortDate ? new Date(b.sortDate).getTime() : 0
    return dateB - dateA
  })

  // Take only `limit` items from the merged result
  const items = merged.slice(0, limit)

  // hasMore: true if we have more merged items than the limit,
  // OR if either source returned a full page (meaning there could be more)
  const hasMore =
    merged.length > limit ||
    emailThreads.length >= limit ||
    transcriptRows.length >= limit

  // Cursor for next page: the sortDate of the last returned item
  const nextCursor = items.length > 0 ? items[items.length - 1].sortDate : null

  return NextResponse.json({
    ok: true,
    items,
    emailCount: triageEmails.length,
    transcriptCount: triageTranscripts.length,
    hasMore,
    nextCursor,
  })
}
