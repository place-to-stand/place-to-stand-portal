import { and, eq, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { oauthConnections, clients } from '@/lib/db/schema'
import {
  listThreadsForUser,
  getThreadCountsForUser,
} from '@/lib/queries/threads'
import { getMessageCountsForUser } from '@/lib/queries/messages'
import { InboxPanel } from './_components/inbox-panel'

const PAGE_SIZE = 25

type FilterType = 'all' | 'linked' | 'unlinked'

type Props = {
  searchParams: Promise<{ page?: string; filter?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const user = await requireUser()
  const params = await searchParams

  // Parse page number and filter from URL
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE
  const filter: FilterType = ['all', 'linked', 'unlinked'].includes(params.filter || '')
    ? (params.filter as FilterType)
    : 'all'

  // Get threads, counts, sync status, and clients in parallel
  const [
    threadSummaries,
    threadCounts,
    messageCounts,
    [connection],
    clientsList,
  ] = await Promise.all([
    listThreadsForUser(user.id, { limit: PAGE_SIZE, offset, linkedFilter: filter }),
    getThreadCountsForUser(user.id, { linkedFilter: filter }),
    getMessageCountsForUser(user.id),
    db
      .select({ lastSyncAt: oauthConnections.lastSyncAt })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, user.id),
          eq(oauthConnections.provider, 'GOOGLE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
  ])

  const syncStatus = {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalMessages: messageCounts.total,
    unread: messageCounts.unread,
  }

  const totalPages = Math.ceil(threadCounts.total / PAGE_SIZE)

  return (
    <InboxPanel
      threads={threadSummaries}
      syncStatus={syncStatus}
      clients={clientsList}
      isAdmin={isAdmin(user)}
      filter={filter}
      pagination={{
        currentPage,
        totalPages,
        totalItems: threadCounts.total,
        pageSize: PAGE_SIZE,
      }}
    />
  )
}
