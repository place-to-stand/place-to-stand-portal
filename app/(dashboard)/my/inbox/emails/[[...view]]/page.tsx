import { and, eq, isNull, sql } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { oauthConnections, clients, projects, emailDrafts, leads } from '@/lib/db/schema'
import {
  listThreadsForUser,
  getThreadCountsForUser,
  getThreadSummaryById,
  getInboxSidebarCounts,
} from '@/lib/queries/threads'
import { getMessageCountsForUser } from '@/lib/queries/messages'
import { InboxPanel } from '../../_components/inbox-panel'

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

const PAGE_SIZE = 25

type FilterType = 'all' | 'linked' | 'unlinked' | 'sent'
type ViewType = 'inbox' | 'sent' | 'drafts' | 'scheduled' | 'linked' | 'unlinked'

type Props = {
  params: Promise<{ view?: string[] }>
  searchParams: Promise<{ page?: string; thread?: string; q?: string }>
}

export default async function InboxEmailsPage({ params, searchParams }: Props) {
  const user = await requireUser()
  const resolvedParams = await params
  const query = await searchParams

  // Extract view from path segment (e.g., /my/inbox/emails/sent → 'sent')
  const validViews: ViewType[] = ['inbox', 'sent', 'drafts', 'scheduled', 'linked', 'unlinked']
  const viewSegment = resolvedParams.view?.[0]
  const view: ViewType = validViews.includes(viewSegment as ViewType)
    ? (viewSegment as ViewType)
    : 'inbox'

  // Parse page number and search from URL
  const currentPage = Math.max(1, parseInt(query.page || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Map view to filter for backwards compatibility with thread queries
  const filter: FilterType = view === 'linked' ? 'linked'
    : view === 'unlinked' ? 'unlinked'
    : view === 'sent' ? 'sent'
    : 'all'
  const searchQuery = query.q?.trim() || undefined

  // Parse thread param for deep-linking
  const threadId = query.thread || null

  // Determine query options based on filter
  const isSentFilter = filter === 'sent'
  const linkedFilter = isSentFilter ? undefined : (filter === 'all' ? undefined : filter)
  // Use 'inbox' filter for default view to exclude sent-only threads, 'sent' for sent view
  const sentFilter = isSentFilter ? 'sent' : 'inbox'

  // Get threads, counts, sync status, clients, projects, leads, and draft counts in parallel
  const [
    threadSummaries,
    threadCounts,
    messageCounts,
    draftCounts,
    sidebarCountsResult,
    [connection],
    clientsList,
    projectsList,
    leadsList,
    linkedThread,
  ] = await Promise.all([
    listThreadsForUser(user.id, { limit: PAGE_SIZE, offset, linkedFilter, sentFilter, search: searchQuery }),
    getThreadCountsForUser(user.id, { linkedFilter, sentFilter, search: searchQuery }),
    getMessageCountsForUser(user.id),
    getDraftCounts(user.id),
    getInboxSidebarCounts(user.id),
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
    db
      .select({ id: leads.id, contactName: leads.contactName })
      .from(leads)
      .where(isNull(leads.deletedAt))
      .orderBy(leads.contactName),
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
    inbox: sidebarCountsResult.inbox,
    unread: messageCounts.unread,
    drafts: draftCounts.drafts,
    sent: sidebarCountsResult.sent,
    scheduled: draftCounts.scheduled,
    linked: sidebarCountsResult.linked,
    unlinked: sidebarCountsResult.unlinked,
  }

  return (
    <InboxPanel
      threads={threadSummaries}
      syncStatus={syncStatus}
      clients={clientsList}
      projects={projectsList}
      leads={leadsList}
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
