import 'server-only'

import { and, desc, eq, isNull, inArray, sql, or } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { threads, messages, clients, projects, leads } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'
import type { Thread, ThreadSummary, ThreadStatus } from '@/lib/types/messages'

// ─────────────────────────────────────────────────────────────────────────────
// Thread CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getThreadById(user: AppUser, id: string): Promise<Thread | null> {
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, id), isNull(threads.deletedAt)))
    .limit(1)

  if (!thread) return null

  // Access check: admin, owner, or member of linked client/project
  // TODO: For non-admins who aren't the creator, add client_members check
  // to verify they have access to threads linked to their clients

  return thread
}

/**
 * Get a single thread summary by ID with all related data for the inbox UI
 */
export async function getThreadSummaryById(
  userId: string,
  threadId: string
): Promise<ThreadSummary | null> {
  // Fetch the thread
  const [thread] = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.id, threadId),
        isNull(threads.deletedAt),
        // User must have access (creator or has messages in thread)
        or(
          eq(threads.createdBy, userId),
          sql`EXISTS (
            SELECT 1 FROM messages
            WHERE messages.thread_id = ${threads.id}
            AND messages.user_id = ${userId}
            AND messages.deleted_at IS NULL
          )`
        )
      )
    )
    .limit(1)

  if (!thread) return null

  // Get client and project info
  const [clientRow, projectRow] = await Promise.all([
    thread.clientId
      ? db
          .select({ id: clients.id, name: clients.name, slug: clients.slug })
          .from(clients)
          .where(eq(clients.id, thread.clientId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    thread.projectId
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientSlug: clients.slug,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(eq(projects.id, thread.projectId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
  ])

  // Get latest message
  const [latestMessage] = await db
    .select({
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        eq(messages.threadId, threadId),
        isNull(messages.deletedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(1)

  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails ?? [],
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: clientRow,
    project: projectRow,
    latestMessage: latestMessage
      ? {
          id: latestMessage.id,
          snippet: latestMessage.snippet,
          fromEmail: latestMessage.fromEmail,
          fromName: latestMessage.fromName,
          sentAt: latestMessage.sentAt,
          isInbound: latestMessage.isInbound,
          isRead: latestMessage.isRead,
        }
      : undefined,
  }
}

export async function getThreadByExternalId(
  externalThreadId: string,
  _userId: string
): Promise<Thread | null> {
  // Find thread by external ID only - don't require messages to exist.
  // This prevents orphan thread creation when sync fails partway through:
  // if a thread is created but messages fail to sync, subsequent syncs
  // should find and reuse the existing thread, not create duplicates.
  const [thread] = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.externalThreadId, externalThreadId),
        isNull(threads.deletedAt)
      )
    )
    .limit(1)

  return thread ?? null
}

export type CreateThreadInput = {
  clientId?: string | null
  projectId?: string | null
  subject?: string | null
  status?: ThreadStatus
  source: 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM'
  externalThreadId?: string | null
  participantEmails?: string[]
  createdBy?: string | null
  metadata?: Record<string, unknown>
}

export async function createThread(input: CreateThreadInput): Promise<Thread> {
  const [thread] = await db
    .insert(threads)
    .values({
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      subject: input.subject ?? null,
      status: input.status ?? 'OPEN',
      source: input.source,
      externalThreadId: input.externalThreadId ?? null,
      participantEmails: input.participantEmails ?? [],
      createdBy: input.createdBy ?? null,
      metadata: input.metadata ?? {},
    })
    .returning()

  return thread
}

export async function updateThread(
  id: string,
  updates: Partial<Pick<Thread, 'clientId' | 'projectId' | 'leadId' | 'subject' | 'status' | 'participantEmails' | 'lastMessageAt' | 'messageCount' | 'metadata'>>
): Promise<Thread> {
  const [updated] = await db
    .update(threads)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, id))
    .returning()

  if (!updated) throw new NotFoundError('Thread not found')
  return updated
}

export async function findOrCreateThread(
  externalThreadId: string,
  userId: string,
  defaults: Omit<CreateThreadInput, 'externalThreadId'>
): Promise<{ thread: Thread; created: boolean }> {
  // Try to find existing thread
  const existing = await getThreadByExternalId(externalThreadId, userId)
  if (existing) {
    return { thread: existing, created: false }
  }

  // Create new thread
  const thread = await createThread({
    ...defaults,
    externalThreadId,
  })

  return { thread, created: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread Listing
// ─────────────────────────────────────────────────────────────────────────────

export type ListThreadsOptions = {
  clientId?: string
  projectId?: string
  status?: ThreadStatus
  linkedFilter?: 'all' | 'linked' | 'unlinked'
  /** Filter threads by message direction: 'sent' = outbound, 'inbox' = inbound only */
  sentFilter?: 'sent' | 'inbox'
  /** Search threads by subject or message content (case-insensitive) */
  search?: string
  limit?: number
  offset?: number
}

export async function listThreadsForUser(
  userId: string,
  options: ListThreadsOptions = {}
): Promise<ThreadSummary[]> {
  const { clientId, projectId, status, linkedFilter, sentFilter, search, limit = 50, offset = 0 } = options

  const conditions = [isNull(threads.deletedAt)]

  // Search filter - supports operators and text search (can be combined)
  if (search && search.trim()) {
    let remainingSearch = search.trim()

    // Handle has:attachment operator
    if (remainingSearch.toLowerCase().includes('has:attachment')) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.user_id = ${userId}
          AND messages.deleted_at IS NULL
          AND messages.has_attachments = true
        )`
      )
      remainingSearch = remainingSearch.replace(/has:attachment/gi, '').trim()
    }

    // Handle is:unread operator
    if (remainingSearch.toLowerCase().includes('is:unread')) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.user_id = ${userId}
          AND messages.deleted_at IS NULL
          AND messages.is_read = false
        )`
      )
      remainingSearch = remainingSearch.replace(/is:unread/gi, '').trim()
    }

    // If there's remaining text after removing operators, do text search
    if (remainingSearch) {
      const searchPattern = `%${remainingSearch}%`
      conditions.push(
        or(
          sql`${threads.subject} ILIKE ${searchPattern}`,
          sql`EXISTS (
            SELECT 1 FROM messages
            WHERE messages.thread_id = ${threads.id}
            AND messages.user_id = ${userId}
            AND messages.deleted_at IS NULL
            AND (
              messages.snippet ILIKE ${searchPattern}
              OR messages.from_email ILIKE ${searchPattern}
              OR messages.from_name ILIKE ${searchPattern}
            )
          )`
        )!
      )
    }
  }

  if (clientId) {
    conditions.push(eq(threads.clientId, clientId))
  }
  if (projectId) {
    conditions.push(eq(threads.projectId, projectId))
  }
  if (status) {
    conditions.push(eq(threads.status, status))
  }
  if (linkedFilter === 'linked') {
    conditions.push(sql`${threads.clientId} IS NOT NULL`)
  } else if (linkedFilter === 'unlinked') {
    conditions.push(isNull(threads.clientId))
  }

  // Filter by message direction
  if (sentFilter === 'sent') {
    // Show threads with outbound messages
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.is_inbound = false
        AND messages.deleted_at IS NULL
      )`
    )
  } else if (sentFilter === 'inbox') {
    // Show only threads with at least one inbound message (exclude sent-only threads)
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.is_inbound = true
        AND messages.deleted_at IS NULL
      )`
    )
  }

  // User must have at least one message in the thread OR be the creator
  conditions.push(
    or(
      eq(threads.createdBy, userId),
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.deleted_at IS NULL
      )`
    )!
  )

  const threadRows = await db
    .select()
    .from(threads)
    .where(and(...conditions))
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit)
    .offset(offset)

  if (threadRows.length === 0) return []

  // Get client and project names
  const clientIds = [...new Set(threadRows.map(t => t.clientId).filter(Boolean))] as string[]
  const projectIds = [...new Set(threadRows.map(t => t.projectId).filter(Boolean))] as string[]

  const [clientRows, projectRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, name: clients.name, slug: clients.slug }).from(clients).where(inArray(clients.id, clientIds))
      : [],
    projectIds.length > 0
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientSlug: clients.slug,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(inArray(projects.id, projectIds))
      : [],
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  // Get latest message for each thread
  const threadIds = threadRows.map(t => t.id)
  const latestMessages = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, threadIds),
        isNull(messages.deletedAt),
        sql`${messages.sentAt} = (
          SELECT MAX(m2.sent_at)
          FROM messages m2
          WHERE m2.thread_id = ${messages.threadId}
          AND m2.deleted_at IS NULL
        )`
      )
    )

  const latestMessageMap = new Map(latestMessages.map(m => [m.threadId, m]))

  return threadRows.map(thread => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails ?? [],
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: thread.clientId ? clientMap.get(thread.clientId) ?? null : null,
    project: thread.projectId ? projectMap.get(thread.projectId) ?? null : null,
    latestMessage: latestMessageMap.get(thread.id) ?? null,
  }))
}

export async function listThreadsForClient(
  clientId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ThreadSummary[]> {
  const { limit = 50, offset = 0 } = options

  const threadRows = await db
    .select()
    .from(threads)
    .where(and(eq(threads.clientId, clientId), isNull(threads.deletedAt)))
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit)
    .offset(offset)

  if (threadRows.length === 0) return []

  // Get project names
  const projectIds = [...new Set(threadRows.map(t => t.projectId).filter(Boolean))] as string[]

  // Get client info first so we have the slug for project URLs
  const [client] = await db
    .select({ id: clients.id, name: clients.name, slug: clients.slug })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  const projectRows = projectIds.length > 0
    ? await db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
        })
        .from(projects)
        .where(inArray(projects.id, projectIds))
    : []

  // Add clientSlug to each project row
  const projectMap = new Map(
    projectRows.map(p => [p.id, { ...p, clientSlug: client?.slug ?? null }])
  )

  // Get latest message for each thread
  const threadIds = threadRows.map(t => t.id)
  const latestMessages = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, threadIds),
        isNull(messages.deletedAt),
        sql`${messages.sentAt} = (
          SELECT MAX(m2.sent_at)
          FROM messages m2
          WHERE m2.thread_id = ${messages.threadId}
          AND m2.deleted_at IS NULL
        )`
      )
    )

  const latestMessageMap = new Map(latestMessages.map(m => [m.threadId, m]))

  return threadRows.map(thread => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails ?? [],
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: client ?? null,
    project: thread.projectId ? projectMap.get(thread.projectId) ?? null : null,
    latestMessage: latestMessageMap.get(thread.id) ?? null,
  }))
}

export async function listThreadsForLead(
  leadId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ThreadSummary[]> {
  const { limit = 50, offset = 0 } = options

  // Get the lead's contact email for matching
  const [lead] = await db
    .select({ contactEmail: leads.contactEmail })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1)

  const contactEmail = lead?.contactEmail?.toLowerCase().trim()

  // Find threads that are either:
  // 1. Explicitly linked to this lead via lead_id
  // 2. Have the lead's contact email in participant_emails
  const threadRows = await db
    .select()
    .from(threads)
    .where(
      and(
        isNull(threads.deletedAt),
        contactEmail
          ? or(
              eq(threads.leadId, leadId),
              sql`lower(${contactEmail}) = ANY(${threads.participantEmails})`
            )
          : eq(threads.leadId, leadId)
      )
    )
    .orderBy(desc(threads.lastMessageAt))
    .limit(limit)
    .offset(offset)

  if (threadRows.length === 0) return []

  // Get client and project info if linked
  const clientIds = [...new Set(threadRows.map(t => t.clientId).filter(Boolean))] as string[]
  const projectIds = [...new Set(threadRows.map(t => t.projectId).filter(Boolean))] as string[]

  const [clientRows, projectRows] = await Promise.all([
    clientIds.length > 0
      ? db.select({ id: clients.id, name: clients.name, slug: clients.slug }).from(clients).where(inArray(clients.id, clientIds))
      : [],
    projectIds.length > 0
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientSlug: clients.slug,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(inArray(projects.id, projectIds))
      : [],
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c]))
  const projectMap = new Map(projectRows.map(p => [p.id, p]))

  // Get latest message for each thread
  const threadIds = threadRows.map(t => t.id)
  const latestMessages = await db
    .select({
      threadId: messages.threadId,
      id: messages.id,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, threadIds),
        isNull(messages.deletedAt),
        sql`${messages.sentAt} = (
          SELECT MAX(m2.sent_at)
          FROM messages m2
          WHERE m2.thread_id = ${messages.threadId}
          AND m2.deleted_at IS NULL
        )`
      )
    )

  const latestMessageMap = new Map(latestMessages.map(m => [m.threadId, m]))

  return threadRows.map(thread => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status as ThreadStatus,
    source: thread.source as 'EMAIL' | 'CHAT' | 'VOICE_MEMO' | 'DOCUMENT' | 'FORM',
    participantEmails: thread.participantEmails ?? [],
    lastMessageAt: thread.lastMessageAt,
    messageCount: thread.messageCount,
    client: thread.clientId ? clientMap.get(thread.clientId) ?? null : null,
    project: thread.projectId ? projectMap.get(thread.projectId) ?? null : null,
    latestMessage: latestMessageMap.get(thread.id) ?? null,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Thread Counts
// ─────────────────────────────────────────────────────────────────────────────

export async function getThreadCountsForUser(
  userId: string,
  options: { linkedFilter?: 'all' | 'linked' | 'unlinked'; sentFilter?: 'sent' | 'inbox'; search?: string } = {}
): Promise<{
  total: number
  unread: number
  byStatus: Record<ThreadStatus, number>
}> {
  const { linkedFilter, sentFilter, search } = options

  const userThreadCondition = or(
    eq(threads.createdBy, userId),
    sql`EXISTS (
      SELECT 1 FROM messages
      WHERE messages.thread_id = ${threads.id}
      AND messages.user_id = ${userId}
      AND messages.deleted_at IS NULL
    )`
  )

  const conditions = [isNull(threads.deletedAt), userThreadCondition]

  // Search filter - supports operators and text search (can be combined)
  if (search && search.trim()) {
    let remainingSearch = search.trim()

    // Handle has:attachment operator
    if (remainingSearch.toLowerCase().includes('has:attachment')) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.user_id = ${userId}
          AND messages.deleted_at IS NULL
          AND messages.has_attachments = true
        )`
      )
      remainingSearch = remainingSearch.replace(/has:attachment/gi, '').trim()
    }

    // Handle is:unread operator
    if (remainingSearch.toLowerCase().includes('is:unread')) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM messages
          WHERE messages.thread_id = ${threads.id}
          AND messages.user_id = ${userId}
          AND messages.deleted_at IS NULL
          AND messages.is_read = false
        )`
      )
      remainingSearch = remainingSearch.replace(/is:unread/gi, '').trim()
    }

    // If there's remaining text after removing operators, do text search
    if (remainingSearch) {
      const searchPattern = `%${remainingSearch}%`
      conditions.push(
        or(
          sql`${threads.subject} ILIKE ${searchPattern}`,
          sql`EXISTS (
            SELECT 1 FROM messages
            WHERE messages.thread_id = ${threads.id}
            AND messages.user_id = ${userId}
            AND messages.deleted_at IS NULL
            AND (
              messages.snippet ILIKE ${searchPattern}
              OR messages.from_email ILIKE ${searchPattern}
              OR messages.from_name ILIKE ${searchPattern}
            )
          )`
        )!
      )
    }
  }

  if (linkedFilter === 'linked') {
    conditions.push(sql`${threads.clientId} IS NOT NULL`)
  } else if (linkedFilter === 'unlinked') {
    conditions.push(isNull(threads.clientId))
  }

  // Filter by message direction
  if (sentFilter === 'sent') {
    // Show threads with outbound messages
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.is_inbound = false
        AND messages.deleted_at IS NULL
      )`
    )
  } else if (sentFilter === 'inbox') {
    // Show only threads with at least one inbound message (exclude sent-only threads)
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM messages
        WHERE messages.thread_id = ${threads.id}
        AND messages.user_id = ${userId}
        AND messages.is_inbound = true
        AND messages.deleted_at IS NULL
      )`
    )
  }

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'OPEN')::int`,
      resolved: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'RESOLVED')::int`,
      archived: sql<number>`count(*) FILTER (WHERE ${threads.status} = 'ARCHIVED')::int`,
    })
    .from(threads)
    .where(and(...conditions))

  // Count unread (threads with unread messages)
  const [unreadResult] = await db
    .select({
      count: sql<number>`count(DISTINCT ${threads.id})::int`,
    })
    .from(threads)
    .innerJoin(messages, eq(messages.threadId, threads.id))
    .where(
      and(
        isNull(threads.deletedAt),
        isNull(messages.deletedAt),
        eq(messages.isRead, false),
        eq(messages.userId, userId)
      )
    )

  return {
    total: counts?.total ?? 0,
    unread: unreadResult?.count ?? 0,
    byStatus: {
      OPEN: counts?.open ?? 0,
      RESOLVED: counts?.resolved ?? 0,
      ARCHIVED: counts?.archived ?? 0,
    },
  }
}
