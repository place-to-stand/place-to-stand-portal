import 'server-only'

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { messages, oauthConnections } from '@/lib/db/schema'
import {
  listMessages,
  getMessage,
  getMessageRaw,
  getAttachment,
  getAttachmentMetadata,
  normalizeEmail,
} from '@/lib/gmail/client'
import { findOrCreateThread } from '@/lib/queries/threads'
import {
  getMessageByExternalId,
  createMessage,
  createEmailRaw,
  createMessageAttachment,
} from '@/lib/queries/messages'
import { uploadEmailRaw } from '@/lib/storage/email-raw'
import { uploadEmailAttachment } from '@/lib/storage/email-attachments'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { GmailMessage } from '@/lib/gmail/types'

const BATCH_SIZE = 50
const MAX_SYNC = 500

type SyncResult = { synced: number; skipped: number; errors: string[] }

type SyncOptions = {
  /** Store raw MIME content in Supabase Storage */
  storeRawMime?: boolean
  /** Store attachments in Supabase Storage */
  storeAttachments?: boolean
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

/** Sync Gmail messages for a single user */
export async function syncGmailForUser(
  userId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { storeRawMime = false, storeAttachments = false } = options
  const result: SyncResult = { synced: 0, skipped: 0, errors: [] }

  // Get Supabase client for storage operations
  const supabase = storeRawMime || storeAttachments ? getSupabaseServerClient() : null

  // List recent messages
  const listRes = await listMessages(userId, { maxResults: MAX_SYNC })
  const messageRefs = listRes.messages || []
  if (messageRefs.length === 0) return result

  const gmailIds = messageRefs.map(m => m.id)

  // Check which already exist
  const existing = await db
    .select({ externalMessageId: messages.externalMessageId })
    .from(messages)
    .where(and(eq(messages.userId, userId), inArray(messages.externalMessageId, gmailIds)))

  const existingSet = new Set(existing.map(e => e.externalMessageId).filter(Boolean))
  const newIds = gmailIds.filter(id => !existingSet.has(id))
  result.skipped = existingSet.size

  if (newIds.length === 0) return result

  // Fetch and insert in batches
  for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
    const batch = newIds.slice(i, i + BATCH_SIZE)
    const gmailMessages: GmailMessage[] = []

    // Fetch messages (parallel within batch)
    const fetches = await Promise.allSettled(batch.map(id => getMessage(userId, id)))
    for (const f of fetches) {
      if (f.status === 'fulfilled') gmailMessages.push(f.value)
      else result.errors.push(f.reason?.message || 'fetch error')
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
        // Find or create thread
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

        // Create messages for this thread
        for (const msg of threadMessages) {
          // Check if message already exists (double-check within loop)
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

          const createdMessage = await createMessage({
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

          // Store raw MIME content if requested
          if (storeRawMime && supabase) {
            try {
              const rawMime = await getMessageRaw(userId, msg.id)
              const { storagePath, checksum, sizeBytes } = await uploadEmailRaw({
                client: supabase,
                userId,
                messageId: msg.id,
                rawMime,
              })
              await createEmailRaw({
                messageId: createdMessage.id,
                storagePath,
                checksum,
                sizeBytes,
              })
            } catch (rawErr) {
              result.errors.push(`Raw MIME error for ${msg.id}: ${rawErr instanceof Error ? rawErr.message : 'unknown'}`)
            }
          }

          // Store attachments if requested
          if (storeAttachments && supabase && hasAttachments) {
            try {
              const attachmentMeta = getAttachmentMetadata(msg)
              for (const att of attachmentMeta) {
                try {
                  const attachmentData = await getAttachment(userId, msg.id, att.attachmentId)
                  const { storagePath, fileSize } = await uploadEmailAttachment({
                    client: supabase,
                    userId,
                    messageId: msg.id,
                    attachmentId: att.attachmentId,
                    content: attachmentData,
                    mimeType: att.mimeType,
                    originalName: att.filename,
                  })
                  await createMessageAttachment({
                    messageId: createdMessage.id,
                    storagePath,
                    originalName: att.filename,
                    mimeType: att.mimeType,
                    fileSize,
                    contentId: att.contentId,
                    isInline: att.isInline,
                  })
                } catch (attErr) {
                  result.errors.push(`Attachment error for ${msg.id}/${att.attachmentId}: ${attErr instanceof Error ? attErr.message : 'unknown'}`)
                }
              }
            } catch (metaErr) {
              result.errors.push(`Attachment metadata error for ${msg.id}: ${metaErr instanceof Error ? metaErr.message : 'unknown'}`)
            }
          }

          result.synced++
        }
      } catch (err) {
        result.errors.push(err instanceof Error ? err.message : 'insert error')
      }
    }
  }

  // Update last sync time
  await db
    .update(oauthConnections)
    .set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE')))

  return result
}

/** Get sync status for a user */
export async function getEmailSyncStatus(userId: string) {
  const [[connection], [stats]] = await Promise.all([
    db
      .select({ lastSyncAt: oauthConnections.lastSyncAt })
      .from(oauthConnections)
      .where(and(eq(oauthConnections.userId, userId), eq(oauthConnections.provider, 'GOOGLE'), isNull(oauthConnections.deletedAt)))
      .limit(1),
    db
      .select({ count: messages.id })
      .from(messages)
      .where(and(eq(messages.userId, userId), isNull(messages.deletedAt))),
  ])

  return {
    connected: !!connection,
    lastSyncAt: connection?.lastSyncAt ?? null,
    totalEmails: stats ? 1 : 0, // Note: This is a simple check, not actual count
  }
}
