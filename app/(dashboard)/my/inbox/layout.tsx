import type { ReactNode } from 'react'
import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { oauthConnections } from '@/lib/db/schema'
import { getInboxSidebarCounts } from '@/lib/queries/threads'

import { InboxHeader } from './_components/inbox-header'
import { InboxTabsRow } from './_components/inbox-tabs-row'

export default async function InboxLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()

  const [counts, [connection]] = await Promise.all([
    getInboxSidebarCounts(user.id),
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
          isConnected={!!connection}
          lastSyncAt={connection?.lastSyncAt ?? null}
        />
        {children}
      </div>
    </>
  )
}
