import { NextResponse } from 'next/server'

import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { getInboxSidebarCounts } from '@/lib/queries/threads'
import { getTranscriptCounts } from '@/lib/queries/transcripts'

export async function GET() {
  const user = await requireUser()
  const userIsAdmin = isAdmin(user)

  const [emailCounts, transcriptCounts] = await Promise.all([
    getInboxSidebarCounts(user.id),
    userIsAdmin
      ? getTranscriptCounts()
      : Promise.resolve({ unclassified: 0, classified: 0, dismissed: 0 }),
  ])

  const inboxTriageCount =
    emailCounts.unclassified + transcriptCounts.unclassified

  return NextResponse.json({ inboxTriageCount })
}
