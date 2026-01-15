import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { listMessagesForThread } from '@/lib/queries/messages'
import { getThreadById } from '@/lib/queries/threads'
import {
  getMessage,
  getCidAttachmentMappings,
  getAttachmentMetadata,
  type CidAttachmentMapping,
  type AttachmentMetadata,
} from '@/lib/gmail/client'

type MessageAttachmentData = {
  cidMappings: CidAttachmentMapping[]
  attachments: AttachmentMetadata[]
}

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

  // For messages with attachments, fetch CID mappings and attachment metadata from Gmail
  const attachmentDataMap: Record<string, MessageAttachmentData> = {}

  const messagesWithAttachments = messages.filter(m => m.hasAttachments && m.externalMessageId)

  if (messagesWithAttachments.length > 0) {
    // Fetch attachment data in parallel (limit to avoid rate limits)
    const batchSize = 5
    for (let i = 0; i < messagesWithAttachments.length; i += batchSize) {
      const batch = messagesWithAttachments.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (msg) => {
          try {
            const gmailMsg = await getMessage(user.id, msg.externalMessageId!)
            const cidMappings = getCidAttachmentMappings(gmailMsg)
            const attachments = getAttachmentMetadata(gmailMsg)
            return {
              messageId: msg.id,
              externalMessageId: msg.externalMessageId,
              cidMappings,
              attachments,
            }
          } catch (err) {
            console.error(`Failed to fetch attachment data for message ${msg.id}:`, err)
            return {
              messageId: msg.id,
              externalMessageId: msg.externalMessageId,
              cidMappings: [],
              attachments: [],
            }
          }
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { messageId, cidMappings, attachments } = result.value
          if (cidMappings.length > 0 || attachments.length > 0) {
            attachmentDataMap[messageId] = { cidMappings, attachments }
          }
        }
      }
    }
  }

  // Build backwards-compatible response (cidMappings) plus new attachments data
  const cidMappingsMap: Record<string, CidAttachmentMapping[]> = {}
  const attachmentsMap: Record<string, AttachmentMetadata[]> = {}

  for (const [msgId, data] of Object.entries(attachmentDataMap)) {
    if (data.cidMappings.length > 0) {
      cidMappingsMap[msgId] = data.cidMappings
    }
    if (data.attachments.length > 0) {
      attachmentsMap[msgId] = data.attachments
    }
  }

  return NextResponse.json({
    ok: true,
    messages,
    cidMappings: cidMappingsMap,
    attachments: attachmentsMap,
    thread: {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
    },
  })
}
