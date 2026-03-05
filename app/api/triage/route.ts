import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listThreadsForUser } from '@/lib/queries/threads'
import { suggestClientMatch, suggestLeadMatch } from '@/lib/email/suggestions'

export async function GET(request: Request) {
  const user = await requireUser()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const threads = await listThreadsForUser(user.id, {
    classificationFilter: 'UNCLASSIFIED',
    sentFilter: 'inbox',
    limit: limit + 1, // Fetch one extra to determine hasMore
    offset,
  })

  const hasMore = threads.length > limit
  const pageThreads = hasMore ? threads.slice(0, limit) : threads

  // Run suggestions in parallel for all threads
  const triageThreads = await Promise.all(
    pageThreads.map(async thread => {
      const [clientSuggestion, leadSuggestion] = await Promise.all([
        suggestClientMatch(thread.participantEmails),
        suggestLeadMatch(thread.participantEmails),
      ])

      return {
        ...thread,
        clientSuggestion,
        leadSuggestion,
      }
    })
  )

  return NextResponse.json({
    ok: true,
    threads: triageThreads,
    total: offset + threads.length, // Approximate
    hasMore,
  })
}
