import type { ReactNode } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { isAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { getInboxSidebarCounts } from '@/lib/queries/threads'
import { getTranscriptCounts } from '@/lib/queries/transcripts'

import { InboxHeader } from './_components/inbox-header'
import { InboxTabsRow } from './_components/inbox-tabs-row'

export default async function InboxLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()

  const userIsAdmin = isAdmin(user)

  const [counts, transcriptCounts, [connection]] = await Promise.all([
    getInboxSidebarCounts(user.id),
    userIsAdmin ? getTranscriptCounts() : Promise.resolve({ unclassified: 0, classified: 0, dismissed: 0 }),
    db
      .select({
        lastSyncAt: oauthConnections.lastSyncAt,
        status: oauthConnections.status,
      })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, 'GOOGLE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1),
  ])

  return (
    <>
      <InboxHeader />
      <div className='min-w-0 space-y-4'>
        <InboxTabsRow
          unclassifiedCount={counts.unclassified}
          unclassifiedTranscriptCount={userIsAdmin ? transcriptCounts.unclassified : 0}
          isConnected={!!connection}
          lastSyncAt={connection?.lastSyncAt ?? null}
          showTranscriptsTab={userIsAdmin}
        />
        {children}
      </div>
    </>
  )
}
