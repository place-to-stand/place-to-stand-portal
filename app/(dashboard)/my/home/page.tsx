import type { Metadata } from 'next'

import { HomeDashboard } from '@/components/dashboard/home-dashboard'
import type { TriageWidgetItem } from '@/components/dashboard/triage-widget'
import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { fetchHoursSnapshot } from '@/lib/data/dashboard/hours'
import { fetchAssignedTasksSummary } from '@/lib/data/tasks'
import { getInboxSidebarCounts } from '@/lib/queries/threads'
import { listThreadsForUser } from '@/lib/queries/threads'
import { listTranscripts, getTranscriptCounts } from '@/lib/queries/transcripts'

export const metadata: Metadata = {
  title: 'Home | Place to Stand Portal',
}

export default async function HomePage() {
  const user = await requireUser()
  const now = new Date()
  const currentMonthCursor = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  }

  const userIsAdmin = isAdmin(user)

  const [tasksResult, hoursSnapshot, emailCounts, transcriptCounts, triageEmails, triageTranscripts] =
    await Promise.all([
      fetchAssignedTasksSummary({
        userId: user.id,
        role: user.role,
        limit: 5,
        includeCompletedStatuses: false,
      }),
      fetchHoursSnapshot(user, currentMonthCursor),
      getInboxSidebarCounts(user.id),
      userIsAdmin
        ? getTranscriptCounts()
        : Promise.resolve({ unclassified: 0, classified: 0, dismissed: 0 }),
      listThreadsForUser(user.id, {
        classificationFilter: 'UNCLASSIFIED',
        sentFilter: 'inbox',
        limit: 5,
        offset: 0,
      }),
      userIsAdmin
        ? listTranscripts({ classification: 'UNCLASSIFIED', limit: 5, offset: 0 })
        : Promise.resolve([]),
    ])

  const triageTotalCount = emailCounts.unclassified + transcriptCounts.unclassified

  // Merge emails + transcripts, sort by date, take first 5
  const merged: TriageWidgetItem[] = [
    ...triageEmails.map(thread => ({
      id: thread.id,
      type: 'email' as const,
      title: thread.subject || '(no subject)',
      subtitle: thread.latestMessage?.fromName || thread.latestMessage?.fromEmail || null,
      date: thread.lastMessageAt ?? thread.latestMessage?.sentAt ?? null,
    })),
    ...triageTranscripts.map(t => ({
      id: t.id,
      type: 'transcript' as const,
      title: t.title,
      subtitle: null,
      date: t.meetingDate ?? t.createdAt,
    })),
  ]
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })
    .slice(0, 5)

  return (
    <HomeDashboard
      user={user}
      tasks={tasksResult.items}
      totalTaskCount={tasksResult.totalCount}
      triageItems={merged}
      triageTotalCount={triageTotalCount}
      initialHoursSnapshot={hoursSnapshot}
    />
  )
}
