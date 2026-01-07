import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { messages, oauthConnections } from '@/lib/db/schema'
import {
  listMessages,
  listHistory,
  getMessage,
  getProfile,
  normalizeEmail,
  GmailHistoryExpiredError,
} from '@/lib/gmail/client'
import { findOrCreateThread } from '@/lib/queries/threads'
import { getMessageByExternalId, createMessage } from '@/lib/queries/messages'
import type { GmailMessage, GmailHistoryRecord } from '@/lib/gmail/types'
import type { GmailSyncState } from '@/lib/types/sync-state'

const BATCH_SIZE = 50
const MAX_FULL_SYNC = 500 // Max messages to sync on initial full sync
const MAX_HISTORY_RESULTS = 500 // Max history records per request
const GMAIL_QUERY_FILTER = '-in:spam -in:trash' // Exclude spam and trash from sync

type SyncResult = {
  synced: number
  skipped: number
  labelsUpdated: number
  errors: string[]
  syncType: 'full' | 'incremental'
}

/** Parse "Name <email>" or just "email" format */
function parseEmailAddress(addr: string | null): { email: string; name: string | null } {
  if (!addr) return { email: '', name: null }
  const match = addr.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { email: addr.trim().toLowerCase(), name: null }
}

function checkAttachments(payload?: GmailMessage['payload']): boolean {
  if (!payload) return false
  if (payload.filename && payload.body?.size) return true
  return (payload.parts || []).some(checkAttachments)
}

/** Get all participant emails from a message */
function getParticipantEmails(msg: GmailMessage): string[] {
  const norm = normalizeEmail(msg)
  const from = parseEmailAddress(norm.from).email
  const tos = norm.to.map(e => parseEmailAddress(e).email).filter(Boolean)
  const ccs = norm.cc.map(e => parseEmailAddress(e).email).filter(Boolean)
  return Array.from(new Set([from, ...tos, ...ccs].filter(Boolean)))
}

/** Get the current sync state for a user's Google connection */
async function getConnectionSyncState(
  userId: string
): Promise<{ connectionId: string; syncState: GmailSyncState } | null> {
  const [conn] = await db
    .select({ id: oauthConnections.id, syncState: oauthConnections.syncState })
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, userId),
        eq(oauthConnections.provider, 'GOOGLE'),
        eq(oauthConnections.status, 'ACTIVE'),
        isNull(oauthConnections.deletedAt)
      )
    )
    .limit(1)

  if (!conn) return null
  return { connectionId: conn.id, syncState: (conn.syncState as GmailSyncState) || {} }
}

/** Update sync state on connection after sync completes */
async function updateSyncState(connectionId: string, syncState: GmailSyncState): Promise<void> {
  await db
    .update(oauthConnections)
    .set({
      syncState,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(oauthConnections.id, connectionId))
}

/**
 * Process a batch of Gmail message IDs - fetch full content and store.
 * Shared by both full sync and incremental sync for new messages.
 */
async function processNewMessages(
  userId: string,
  messageIds: string[],
  result: SyncResult
): Promise<string | undefined> {
  if (messageIds.length === 0) return undefined

  let latestHistoryId: string | undefined

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)
    const gmailMessages: GmailMessage[] = []

    // Fetch messages in parallel within batch
    const fetches = await Promise.allSettled(batch.map(id => getMessage(userId, id)))
    for (const f of fetches) {
      if (f.status === 'fulfilled') {
        gmailMessages.push(f.value)
        // Track the highest historyId we see
        if (f.value.historyId) {
          if (!latestHistoryId || f.value.historyId > latestHistoryId) {
            latestHistoryId = f.value.historyId
          }
        }
      } else {
        result.errors.push(f.reason?.message || 'fetch error')
      }
    }

    if (gmailMessages.length === 0) continue

    // Group messages by thread
    const messagesByThread = new Map<string, GmailMessage[]>()
    for (const msg of gmailMessages) {
      const threadId = msg.threadId || msg.id
      const existing = messagesByThread.get(threadId) || []
      existing.push(msg)
      messagesByThread.set(threadId, existing)
    }

    // Process each thread
    for (const [gmailThreadId, threadMessages] of messagesByThread) {
      try {
        const firstMsg = threadMessages[0]
        const norm = normalizeEmail(firstMsg)
        const allParticipants = new Set<string>()
        threadMessages.forEach(m => getParticipantEmails(m).forEach(e => allParticipants.add(e)))

        const { thread } = await findOrCreateThread(gmailThreadId, userId, {
          source: 'EMAIL',
          subject: norm.subject || null,
          participantEmails: Array.from(allParticipants),
          createdBy: userId,
          metadata: {},
        })

        for (const msg of threadMessages) {
          // Check if message already exists
          const existingMsg = await getMessageByExternalId(msg.id, userId)
          if (existingMsg) {
            result.skipped++
            continue
          }

          const msgNorm = normalizeEmail(msg)
          const from = parseEmailAddress(msgNorm.from)
          const hasAttachments = checkAttachments(msg.payload)
          const sentAt = msg.internalDate
            ? new Date(parseInt(msg.internalDate, 10)).toISOString()
            : new Date().toISOString()

          await createMessage({
            threadId: thread.id,
            userId,
            source: 'EMAIL',
            externalMessageId: msg.id,
            subject: msgNorm.subject,
            bodyText: msgNorm.bodyText,
            bodyHtml: msgNorm.bodyHtml,
            snippet: msgNorm.snippet || null,
            fromEmail: from.email || 'unknown@unknown',
            fromName: from.name,
            toEmails: msgNorm.to.map(e => parseEmailAddress(e).email).filter(Boolean),
            ccEmails: msgNorm.cc.map(e => parseEmailAddress(e).email).filter(Boolean),
            sentAt,
            isInbound: !(msg.labelIds || []).includes('SENT'),
            isRead: !(msg.labelIds || []).includes('UNREAD'),
            hasAttachments,
            providerMetadata: { labels: msg.labelIds || [] },
          })

          result.synced++
        }
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : 'insert error')
      }
    }
  }

  return latestHistoryId
}

/**
 * Process label changes from history records.
 * Updates isRead status without re-fetching full message content.
 */
async function processLabelChanges(
  userId: string,
  historyRecords: GmailHistoryRecord[],
  result: SyncResult
): Promise<void> {
  // Collect all label changes
  const readChanges: { messageId: string; isRead: boolean }[] = []

  for (const record of historyRecords) {
    // UNREAD label removed = message marked as read
    for (const change of record.labelsRemoved || []) {
      if (change.labelIds.includes('UNREAD')) {
        readChanges.push({ messageId: change.message.id, isRead: true })
      }
    }
    // UNREAD label added = message marked as unread
    for (const change of record.labelsAdded || []) {
      if (change.labelIds.includes('UNREAD')) {
        readChanges.push({ messageId: change.message.id, isRead: false })
      }
    }
  }

  if (readChanges.length === 0) return

  // Batch update read status in database
  // Group by isRead value to minimize queries
  const toMarkRead = readChanges.filter(c => c.isRead).map(c => c.messageId)
  const toMarkUnread = readChanges.filter(c => !c.isRead).map(c => c.messageId)

  if (toMarkRead.length > 0) {
    await db
      .update(messages)
      .set({ isRead: true, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(messages.userId, userId),
          inArray(messages.externalMessageId, toMarkRead),
          isNull(messages.deletedAt)
        )
      )
    result.labelsUpdated += toMarkRead.length
  }

  if (toMarkUnread.length > 0) {
    await db
      .update(messages)
      .set({ isRead: false, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(messages.userId, userId),
          inArray(messages.externalMessageId, toMarkUnread),
          isNull(messages.deletedAt)
        )
      )
    result.labelsUpdated += toMarkUnread.length
  }
}

/**
 * Full sync: fetch all messages up to MAX_FULL_SYNC.
 * Used for initial sync or when historyId expires.
 */
async function performFullSync(userId: string, result: SyncResult): Promise<string | undefined> {
  result.syncType = 'full'

  // List recent messages (excluding spam and trash)
  const listRes = await listMessages(userId, { maxResults: MAX_FULL_SYNC, q: GMAIL_QUERY_FILTER })
  const messageRefs = listRes.messages || []
  if (messageRefs.length === 0) {
    // No messages, get historyId from profile
    const profile = await getProfile(userId)
    return profile.historyId
  }

  const gmailIds = messageRefs.map(m => m.id)

  // Check which already exist
  const existing = await db
    .select({ externalMessageId: messages.externalMessageId })
    .from(messages)
    .where(and(eq(messages.userId, userId), inArray(messages.externalMessageId, gmailIds)))

  const existingSet = new Set(existing.map(e => e.externalMessageId).filter(Boolean))
  const newIds = gmailIds.filter(id => !existingSet.has(id))
  result.skipped = existingSet.size

  // Process new messages and get latest historyId
  const historyIdFromMessages = await processNewMessages(userId, newIds, result)

  // If we got a historyId from messages, use it; otherwise get from profile
  if (historyIdFromMessages) {
    return historyIdFromMessages
  }

  const profile = await getProfile(userId)
  return profile.historyId
}

/**
 * Incremental sync using history.list API.
 * Only fetches changes since last sync.
 */
async function performIncrementalSync(
  userId: string,
  startHistoryId: string,
  result: SyncResult
): Promise<string> {
  result.syncType = 'incremental'

  let pageToken: string | undefined
  let latestHistoryId = startHistoryId
  const newMessageIds: string[] = []
  const allHistoryRecords: GmailHistoryRecord[] = []

  // Paginate through all history
  do {
    const historyRes = await listHistory(userId, {
      startHistoryId,
      maxResults: MAX_HISTORY_RESULTS,
      pageToken,
      historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved'],
    })

    latestHistoryId = historyRes.historyId
    pageToken = historyRes.nextPageToken

    if (historyRes.history) {
      allHistoryRecords.push(...historyRes.history)

      // Collect new message IDs
      for (const record of historyRes.history) {
        for (const added of record.messagesAdded || []) {
          newMessageIds.push(added.message.id)
        }
      }
    }
  } while (pageToken)

  // Deduplicate message IDs (same message might appear in multiple history records)
  const uniqueNewIds = [...new Set(newMessageIds)]

  // Check which are actually new (not already in our DB)
  if (uniqueNewIds.length > 0) {
    const existing = await db
      .select({ externalMessageId: messages.externalMessageId })
      .from(messages)
      .where(and(eq(messages.userId, userId), inArray(messages.externalMessageId, uniqueNewIds)))

    const existingSet = new Set(existing.map(e => e.externalMessageId).filter(Boolean))
    const actuallyNewIds = uniqueNewIds.filter(id => !existingSet.has(id))
    result.skipped += existingSet.size

    // Fetch and store new messages
    await processNewMessages(userId, actuallyNewIds, result)
  }

  // Process label changes (read/unread status)
  await processLabelChanges(userId, allHistoryRecords, result)

  return latestHistoryId
}

/**
 * Sync Gmail messages for a single user.
 * Uses incremental sync via history.list when possible, falls back to full sync.
 */
export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, labelsUpdated: 0, errors: [], syncType: 'full' }

  const connState = await getConnectionSyncState(userId)
  if (!connState) {
    result.errors.push('No active Google connection found')
    return result
  }

  const { connectionId, syncState } = connState
  let newHistoryId: string | undefined

  try {
    if (syncState.historyId && syncState.fullSyncCompleted) {
      // Incremental sync using history.list
      try {
        newHistoryId = await performIncrementalSync(userId, syncState.historyId, result)
      } catch (err) {
        if (err instanceof GmailHistoryExpiredError) {
          // historyId expired, fall back to full sync
          result.errors.push('History expired, performing full sync')
          newHistoryId = await performFullSync(userId, result)
        } else {
          throw err
        }
      }
    } else {
      // Initial full sync
      newHistoryId = await performFullSync(userId, result)
    }

    // Update sync state with new historyId
    if (newHistoryId) {
      await updateSyncState(connectionId, {
        historyId: newHistoryId,
        fullSyncCompleted: true,
        lastSyncedAt: new Date().toISOString(),
        lastSyncCount: result.synced,
      })
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'sync error')
  }

  return result
}

/** Get sync status for a user */
export async function getEmailSyncStatus(userId: string) {
  const [[connection], [stats]] = await Promise.all([
    db
      .select({
        lastSyncAt: oauthConnections.lastSyncAt,
        syncState: oauthConnections.syncState,
      })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.userId, userId),
          eq(oauthConnections.provider, 'GOOGLE'),
          isNull(oauthConnections.deletedAt)
        )
      )
      .limit(1),
    db
      .select({ count: messages.id })
      .from(messages)
      .where(and(eq(messages.userId, userId), isNull(messages.deletedAt))),
  ])

  const syncState = (connection?.syncState as GmailSyncState) || {}

  return {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    hasCompletedFullSync: syncState.fullSyncCompleted ?? false,
    historyId: syncState.historyId ?? null,
    totalEmails: stats ? 1 : 0, // Note: This is a simple check, not actual count
  }
}
