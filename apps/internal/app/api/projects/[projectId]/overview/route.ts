import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { ensureClientAccessByProjectId, isAdmin } from '@/lib/auth/permissions'
import { listThreadsForUser, getThreadCountsForUser } from '@/lib/queries/threads'
import { listTranscripts, getTranscriptTotalCount } from '@/lib/queries/transcripts'

type RouteParams = {
  params: Promise<{ projectId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await params

  if (!isAdmin(user)) {
    try {
      await ensureClientAccessByProjectId(user, projectId)
    } catch {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const [threads, threadCounts, transcripts, transcriptCount] = await Promise.all([
    listThreadsForUser(user.id, {
      projectId,
      limit: 5,
    }),
    getThreadCountsForUser(user.id, { projectId }),
    listTranscripts({
      projectId,
      classification: 'CLASSIFIED',
      limit: 5,
    }),
    getTranscriptTotalCount({ projectId, classification: 'CLASSIFIED' }),
  ])

  return NextResponse.json({
    ok: true,
    data: {
      threads: threads.map(t => ({
        id: t.id,
        subject: t.subject,
        lastMessageAt: t.lastMessageAt,
        messageCount: t.messageCount,
        participantEmails: t.participantEmails,
      })),
      threadCount: threadCounts.total,
      transcripts: transcripts.map(t => ({
        id: t.id,
        title: t.title,
        meetingDate: t.meetingDate,
        driveFileUrl: t.driveFileUrl,
      })),
      transcriptCount,
    },
  })
}
