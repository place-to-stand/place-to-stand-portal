import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listMessagesForThread } from '@/lib/queries/messages'
import { getThreadById } from '@/lib/queries/threads'
import { getMessage, getCidAttachmentMappings, type CidAttachmentMapping } from '@/lib/gmail/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  const { threadId } = await params

  // Verify thread exists and user has access
  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const messages = await listMessagesForThread(threadId, { limit: 100 })

  // For messages with attachments, fetch CID mappings from Gmail
  const cidMappingsMap: Record<string, CidAttachmentMapping[]> = {}

  const messagesWithAttachments = messages.filter(m => m.hasAttachments && m.externalMessageId)

  if (messagesWithAttachments.length > 0) {
    // Fetch CID mappings in parallel (limit to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < messagesWithAttachments.length; i += batchSize) {
      const batch = messagesWithAttachments.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          try {
            const gmailMsg = await getMessage(user.id, msg.externalMessageId!)
            const mappings = getCidAttachmentMappings(gmailMsg)
            return { messageId: msg.id, externalMessageId: msg.externalMessageId, mappings }
          } catch (err) {
            console.error(`Failed to fetch CID mappings for message ${msg.id}:`, err)
            return { messageId: msg.id, externalMessageId: msg.externalMessageId, mappings: [] }
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.mappings.length > 0) {
          cidMappingsMap[result.value.messageId] = result.value.mappings
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    messages,
    cidMappings: cidMappingsMap,
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
    },
  })
}
