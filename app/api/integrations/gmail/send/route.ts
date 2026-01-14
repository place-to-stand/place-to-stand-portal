import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailDrafts, threads } from '@/lib/db/schema'
import { sendEmail, getMessage } from '@/lib/gmail/client'
import { extractThreadingHeaders } from '@/lib/gmail/threading'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  downloadEmailAttachment,
  type EmailAttachmentMetadata,
} from '@/lib/storage/email-attachments'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  logEmailSendStart,
  logEmailSendSuccess,
  logEmailSendError,
} from '@/lib/logging/email'
import { eq } from 'drizzle-orm'

const sendEmailSchema = z.object({
  connectionId: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  /** Portal thread ID (for replies) */
  threadId: z.string().uuid().optional(),
  /** Gmail message ID being replied to */
  inReplyToMessageId: z.string().optional(),
  /** Supabase storage keys for attachments */
  attachmentKeys: z.array(z.string()).optional(),
  /** Pre-link to client */
  clientId: z.string().uuid().optional(),
  /** Pre-link to project */
  projectId: z.string().uuid().optional(),
  /** Draft ID to mark as sent after successful send */
  draftId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const user = await requireUser()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = sendEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const startTime = Date.now()

  // Log send attempt
  const logContext = {
    userId: user.id,
    draftId: data.draftId,
    threadId: data.threadId,
    recipientCount: data.to.length + (data.cc?.length || 0) + (data.bcc?.length || 0),
    attachmentCount: data.attachmentKeys?.length || 0,
    isReply: !!data.inReplyToMessageId,
    isScheduled: false,
  }
  logEmailSendStart(logContext)

  try {
    // Get threading info if replying to a message
    let gmailThreadId: string | undefined
    let inReplyTo: string | undefined
    let references: string[] | undefined

    if (data.inReplyToMessageId) {
      const originalMessage = await getMessage(user.id, data.inReplyToMessageId, {
        connectionId: data.connectionId,
      })
      const threading = extractThreadingHeaders(originalMessage)
      gmailThreadId = threading.gmailThreadId
      inReplyTo = threading.inReplyTo
      references = threading.references
    }

    // Download attachments from Supabase storage if provided (in parallel)
    let attachments: Array<{
      filename: string
      mimeType: string
      content: Buffer
    }> = []

    if (data.attachmentKeys?.length) {
      const supabase = getSupabaseServiceClient()

      // Get metadata from draft if available (single query)
      const metadataMap = new Map<string, EmailAttachmentMetadata>()
      if (data.draftId) {
        const [draft] = await db
          .select({ attachments: emailDrafts.attachments })
          .from(emailDrafts)
          .where(eq(emailDrafts.id, data.draftId))
          .limit(1)

        if (draft?.attachments) {
          const attachmentList = draft.attachments as EmailAttachmentMetadata[]
          attachmentList.forEach(a => metadataMap.set(a.storageKey, a))
        }
      }

      // Download all attachments in parallel
      attachments = await Promise.all(
        data.attachmentKeys.map(async key => {
          const content = await downloadEmailAttachment({
            client: supabase,
            storageKey: key,
          })
          const metadata = metadataMap.get(key)
          return {
            filename: metadata?.filename || key.split('/').pop() || 'attachment',
            mimeType: metadata?.mimeType || 'application/octet-stream',
            content,
          }
        })
      )
    }

    // Send via Gmail
    const result = await sendEmail(
      user.id,
      {
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        threadId: gmailThreadId,
        inReplyTo,
        references,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      { connectionId: data.connectionId }
    )

    // If this was a draft, mark it as sent
    if (data.draftId) {
      await db
        .update(emailDrafts)
        .set({
          status: 'SENT',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDrafts.id, data.draftId))
    }

    // Update thread message count if we have a portal thread
    if (data.threadId) {
      const [thread] = await db
        .select({ messageCount: threads.messageCount })
        .from(threads)
        .where(eq(threads.id, data.threadId))
        .limit(1)

      if (thread) {
        await db
          .update(threads)
          .set({
            messageCount: (thread.messageCount || 0) + 1,
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(threads.id, data.threadId))
      }
    }

    // Track email sent event
    await captureServerEvent({
      event: 'email_sent',
      distinctId: user.id,
      properties: {
        recipient_count: data.to.length + (data.cc?.length || 0) + (data.bcc?.length || 0),
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length,
        is_reply: !!data.inReplyToMessageId,
        is_scheduled: false,
        has_client_link: !!data.clientId,
        has_project_link: !!data.projectId,
      },
    })

    // Log successful send
    logEmailSendSuccess(
      { ...logContext, messageId: result.id },
      Date.now() - startTime
    )

    return NextResponse.json({
      ok: true,
      data: {
        messageId: result.id,
        threadId: result.threadId,
      },
    })
  } catch (err) {
    // Log error with categorization
    logEmailSendError(logContext, err)

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}
