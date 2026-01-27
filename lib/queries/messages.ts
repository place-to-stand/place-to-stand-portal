import 'server-only'

import { and, desc, eq, isNull, sql, asc } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { messages, threads, users } from '@/lib/db/schema'
import { isAdmin } from '@/lib/auth/permissions'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import type { Message, MessageSource } from '@/lib/types/messages'

// ─────────────────────────────────────────────────────────────────────────────
// Message CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getMessageById(user: AppUser, id: string): Promise<Message | null> {
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, id), isNull(messages.deletedAt)))
    .limit(1)

  if (!message) return null

  // Access check: user owns the message or is admin
  if (!isAdmin(user) && message.userId !== user.id) {
    throw new ForbiddenError('Insufficient permissions to access message')
  }

  return message
}

export async function getMessageByExternalId(
  externalMessageId: string,
  userId: string
): Promise<Message | null> {
  const [message] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.externalMessageId, externalMessageId),
        eq(messages.userId, userId),
        isNull(messages.deletedAt)
      )
    )
    .limit(1)

  return message ?? null
}

export type CreateMessageInput = {
  threadId: string
  userId: string
  source: MessageSource
  externalMessageId?: string | null
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  snippet?: string | null
  fromEmail: string
  fromName?: string | null
  toEmails?: string[]
  ccEmails?: string[]
  sentAt: string
  isInbound?: boolean
  isRead?: boolean
  hasAttachments?: boolean
  providerMetadata?: Record<string, unknown>
}

export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const [message] = await db
    .insert(messages)
    .values({
      threadId: input.threadId,
      userId: input.userId,
      source: input.source,
      externalMessageId: input.externalMessageId ?? null,
      subject: input.subject ?? null,
      bodyText: input.bodyText ?? null,
      bodyHtml: input.bodyHtml ?? null,
      snippet: input.snippet ?? null,
      fromEmail: input.fromEmail,
      fromName: input.fromName ?? null,
      toEmails: input.toEmails ?? [],
      ccEmails: input.ccEmails ?? [],
      sentAt: input.sentAt,
      isInbound: input.isInbound ?? true,
      isRead: input.isRead ?? false,
      hasAttachments: input.hasAttachments ?? false,
      providerMetadata: input.providerMetadata ?? {},
    })
    .returning()

  // Update thread's message count and last message time
  await db
    .update(threads)
    .set({
      messageCount: sql`${threads.messageCount} + 1`,
      lastMessageAt: input.sentAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(threads.id, input.threadId))

  return message
}

export async function markMessageAsRead(user: AppUser, id: string): Promise<Message> {
  const message = await getMessageById(user, id)
  if (!message) throw new NotFoundError('Message not found')

  const [updated] = await db
    .update(messages)
    .set({
      isRead: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(messages.id, id))
    .returning()

  return updated
}

export async function markMessageAsAnalyzed(
  messageId: string,
  version: string
): Promise<Message> {
  const [updated] = await db
    .update(messages)
    .set({
      analyzedAt: new Date().toISOString(),
      analysisVersion: version,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(messages.id, messageId))
    .returning()

  if (!updated) throw new NotFoundError('Message not found')
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Listing
// ─────────────────────────────────────────────────────────────────────────────

export async function listMessagesForThread(
  threadId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Message[]> {
  const { limit = 100, offset = 0 } = options

  const messageRows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
    .orderBy(asc(messages.sentAt))
    .limit(limit)
    .offset(offset)

  return messageRows
}

export async function listMessagesForUser(
  userId: string,
  options: { limit?: number; offset?: number; isRead?: boolean } = {}
): Promise<Message[]> {
  const { limit = 50, offset = 0, isRead } = options

  const conditions = [
    eq(messages.userId, userId),
    isNull(messages.deletedAt),
  ]

  if (isRead !== undefined) {
    conditions.push(eq(messages.isRead, isRead))
  }

  const messageRows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.sentAt))
    .limit(limit)
    .offset(offset)

  return messageRows
}

export async function getUnanalyzedMessagesForUser(
  userId: string,
  options: { limit?: number } = {}
): Promise<Message[]> {
  const { limit = 50 } = options

  const messageRows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        isNull(messages.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(limit)

  return messageRows
}

export async function getUnanalyzedMessagesForClient(
  clientId: string,
  options: { limit?: number } = {}
): Promise<Message[]> {
  const { limit = 50 } = options

  // Get messages that belong to threads linked to this client
  const messageRows = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      userId: messages.userId,
      source: messages.source,
      externalMessageId: messages.externalMessageId,
      subject: messages.subject,
      bodyText: messages.bodyText,
      bodyHtml: messages.bodyHtml,
      snippet: messages.snippet,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      toEmails: messages.toEmails,
      ccEmails: messages.ccEmails,
      sentAt: messages.sentAt,
      isInbound: messages.isInbound,
      isRead: messages.isRead,
      hasAttachments: messages.hasAttachments,
      analyzedAt: messages.analyzedAt,
      analysisVersion: messages.analysisVersion,
      providerMetadata: messages.providerMetadata,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      deletedAt: messages.deletedAt,
    })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .where(
      and(
        eq(threads.clientId, clientId),
        isNull(messages.deletedAt),
        isNull(threads.deletedAt),
        isNull(messages.analyzedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(limit)

  return messageRows
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Counts
// ─────────────────────────────────────────────────────────────────────────────

export async function getMessageCountsForUser(userId: string): Promise<{
  total: number
  unread: number
  unanalyzed: number
}> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) FILTER (WHERE ${messages.isRead} = false)::int`,
      unanalyzed: sql<number>`count(*) FILTER (WHERE ${messages.analyzedAt} IS NULL)::int`,
    })
    .from(messages)
    .where(and(eq(messages.userId, userId), isNull(messages.deletedAt)))

  return {
    total: counts?.total ?? 0,
    unread: counts?.unread ?? 0,
    unanalyzed: counts?.unanalyzed ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages for Client (used by client detail page)
// ─────────────────────────────────────────────────────────────────────────────

export type MessageForClient = {
  id: string
  subject: string | null
  fromEmail: string
  fromName: string | null
  sentAt: string
  threadId: string
  isInbound: boolean
  userId: string
  user: {
    fullName: string | null
    avatarUrl: string | null
    updatedAt: string | null
  } | null
}

export async function getMessagesForClient(
  clientId: string,
  options: { limit?: number } = {}
): Promise<MessageForClient[]> {
  const { limit = 20 } = options

  const rows = await db
    .select({
      id: messages.id,
      subject: messages.subject,
      fromEmail: messages.fromEmail,
      fromName: messages.fromName,
      sentAt: messages.sentAt,
      threadId: messages.threadId,
      isInbound: messages.isInbound,
      userId: messages.userId,
      userFullName: users.fullName,
      userAvatarUrl: users.avatarUrl,
      userUpdatedAt: users.updatedAt,
    })
    .from(messages)
    .innerJoin(threads, eq(threads.id, messages.threadId))
    .leftJoin(users, eq(users.id, messages.userId))
    .where(
      and(
        eq(threads.clientId, clientId),
        isNull(threads.deletedAt),
        isNull(messages.deletedAt)
      )
    )
    .orderBy(desc(messages.sentAt))
    .limit(limit)

  return rows.map(row => ({
    id: row.id,
    subject: row.subject,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    sentAt: row.sentAt,
    threadId: row.threadId,
    isInbound: row.isInbound,
    userId: row.userId,
    user: row.userFullName !== null || row.userAvatarUrl !== null
      ? {
          fullName: row.userFullName,
          avatarUrl: row.userAvatarUrl,
          updatedAt: row.userUpdatedAt,
        }
      : null,
  }))
}
