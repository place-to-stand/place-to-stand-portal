import { and, eq, isNull, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { oauthConnections, clients, projects, emailDrafts } from '@/lib/db/schema'
import {
  listThreadsForUser,
  getThreadCountsForUser,
  getThreadSummaryById,
} from '@/lib/queries/threads'
import { getMessageCountsForUser } from '@/lib/queries/messages'
import { InboxPanel } from './_components/inbox-panel'

async function getDraftCounts(userId: string) {
  const result = await db
    .select({
      drafts: sql<number>`count(*) filter (where status in ('COMPOSING', 'READY') and scheduled_at is null)`,
      scheduled: sql<number>`count(*) filter (where status = 'READY' and scheduled_at is not null)`,
      sent: sql<number>`count(*) filter (where status = 'SENT')`,
    })
    .from(emailDrafts)
    .where(and(eq(emailDrafts.userId, userId), isNull(emailDrafts.deletedAt)))

  return {
    drafts: Number(result[0]?.drafts ?? 0),
    scheduled: Number(result[0]?.scheduled ?? 0),
    sent: Number(result[0]?.sent ?? 0),
  }
}

async function getLinkedUnlinkedCounts(userId: string) {
  // Get counts for linked/unlinked threads (for sidebar)
  const linkedResult = await getThreadCountsForUser(userId, { linkedFilter: 'linked' })
  const unlinkedResult = await getThreadCountsForUser(userId, { linkedFilter: 'unlinked' })
  return {
    linked: linkedResult.total,
    unlinked: unlinkedResult.total,
  }
}

const PAGE_SIZE = 25

type FilterType = 'all' | 'linked' | 'unlinked' | 'sent'
type ViewType = 'inbox' | 'sent' | 'drafts' | 'scheduled' | 'linked' | 'unlinked'

type Props = {
  searchParams: Promise<{ page?: string; filter?: string; view?: string; thread?: string; q?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const user = await requireUser()
  const params = await searchParams

  // Parse page number, view, and search from URL
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Parse view param (new URL-based routing)
  const validViews: ViewType[] = ['inbox', 'sent', 'drafts', 'scheduled', 'linked', 'unlinked']
  const view: ViewType = validViews.includes(params.view as ViewType)
    ? (params.view as ViewType)
    : 'inbox'

  // Map view to filter for backwards compatibility with thread queries
  const filter: FilterType = view === 'linked' ? 'linked'
    : view === 'unlinked' ? 'unlinked'
    : view === 'sent' ? 'sent'
    : 'all'
  const searchQuery = params.q?.trim() || undefined

  // Parse thread param for deep-linking
  const threadId = params.thread || null

  // Determine query options based on filter
  const isSentFilter = filter === 'sent'
  const linkedFilter = isSentFilter ? undefined : (filter === 'all' ? undefined : filter)
  // Use 'inbox' filter for default view to exclude sent-only threads, 'sent' for sent view
  const sentFilter = isSentFilter ? 'sent' : 'inbox'

  // Get threads, counts, sync status, clients, projects, and draft counts in parallel
  const [
    threadSummaries,
    threadCounts,
    messageCounts,
    draftCounts,
    linkedUnlinkedCounts,
    sentCount,
    [connection],
    clientsList,
    projectsList,
    linkedThread,
  ] = await Promise.all([
    listThreadsForUser(user.id, { limit: PAGE_SIZE, offset, linkedFilter, sentFilter, search: searchQuery }),
    getThreadCountsForUser(user.id, { linkedFilter, sentFilter, search: searchQuery }),
    getMessageCountsForUser(user.id),
    getDraftCounts(user.id),
    getLinkedUnlinkedCounts(user.id),
    getThreadCountsForUser(user.id, { sentFilter: 'sent' }),
    db
      .select({
        lastSyncAt: oauthConnections.lastSyncAt,
        status: oauthConnections.status,
        syncState: oauthConnections.syncState,
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
    db
      .select({ id: clients.id, name: clients.name, slug: clients.slug })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        clientSlug: clients.slug,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
    // Fetch the specific thread if deep-linking (may not be on current page)
    threadId ? getThreadSummaryById(user.id, threadId) : null,
  ])

  // Parse syncState for error info
  const syncState = connection?.syncState as { lastError?: string; needsReauth?: boolean } | null

  const syncStatus = {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalMessages: messageCounts.total,
    unread: messageCounts.unread,
    connectionStatus: connection?.status ?? null,
    connectionError: syncState?.lastError ?? null,
  }

  const totalPages = Math.ceil(threadCounts.total / PAGE_SIZE)

  const sidebarCounts = {
    inbox: threadCounts.total,
    unread: messageCounts.unread,
    drafts: draftCounts.drafts,
    sent: sentCount.total,
    scheduled: draftCounts.scheduled,
    linked: linkedUnlinkedCounts.linked,
    unlinked: linkedUnlinkedCounts.unlinked,
  }

  return (
    <InboxPanel
      threads={threadSummaries}
      syncStatus={syncStatus}
      clients={clientsList}
      projects={projectsList}
      isAdmin={isAdmin(user)}
      view={view}
      searchQuery={searchQuery ?? ''}
      sidebarCounts={sidebarCounts}
      pagination={{
        currentPage,
        totalPages,
        totalItems: threadCounts.total,
        pageSize: PAGE_SIZE,
      }}
      initialSelectedThread={linkedThread}
    />
  )
}
