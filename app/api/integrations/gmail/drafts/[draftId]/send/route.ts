import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailDrafts, threads } from '@/lib/db/schema'
import { sendEmail, getMessage } from '@/lib/gmail/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { downloadEmailAttachment } from '@/lib/storage/email-attachments'
import type { EmailAttachmentMetadata } from '@/lib/storage/email-attachments'

type RouteParams = { params: Promise<{ draftId: string }> }

/**
 * POST /api/integrations/gmail/drafts/[draftId]/send
 * Send a draft email
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const user = await requireUser()
  const { draftId } = await params

  // Get the draft
  const [draft] = await db
    .select()
    .from(emailDrafts)
    .where(
      and(
        eq(emailDrafts.id, draftId),
        eq(emailDrafts.userId, user.id),
        isNull(emailDrafts.deletedAt)
      )
    )
    .limit(1)

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Validate required fields
  if (!draft.toEmails || draft.toEmails.length === 0) {
    return NextResponse.json(
      { error: 'At least one recipient is required' },
      { status: 400 }
    )
  }

  if (!draft.subject?.trim()) {
    return NextResponse.json(
      { error: 'Subject is required' },
      { status: 400 }
    )
  }

  try {
    // Mark as sending
    await db
      .update(emailDrafts)
      .set({
        status: 'SENDING',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    // Get threading info if this is a reply
    let gmailThreadId: string | undefined
    let inReplyTo: string | undefined
    let references: string[] | undefined

    if (draft.inReplyToMessageId) {
      const originalMessage = await getMessage(user.id, draft.inReplyToMessageId, {
        connectionId: draft.connectionId,
      })

      gmailThreadId = originalMessage.threadId

      const messageIdHeader = originalMessage.payload?.headers?.find(
        h => h.name.toLowerCase() === 'message-id'
      )
      if (messageIdHeader?.value) {
        inReplyTo = messageIdHeader.value
        references = [messageIdHeader.value]
      }

      const referencesHeader = originalMessage.payload?.headers?.find(
        h => h.name.toLowerCase() === 'references'
      )
      if (referencesHeader?.value) {
        const existingRefs = referencesHeader.value.split(/\s+/).filter(Boolean)
        references = [...existingRefs, ...(references || [])]
      }
    }

    // Download attachments from storage
    const attachments: Array<{
      filename: string
      mimeType: string
      content: Buffer
    }> = []

    const draftAttachments = draft.attachments as EmailAttachmentMetadata[]
    if (draftAttachments?.length > 0) {
      const supabase = getSupabaseServiceClient()

      for (const attachment of draftAttachments) {
        const content = await downloadEmailAttachment({
          client: supabase,
          storageKey: attachment.storageKey,
        })

        attachments.push({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          content,
        })
      }
    }

    // Send the email
    const result = await sendEmail(
      user.id,
      {
        to: draft.toEmails,
        cc: draft.ccEmails || undefined,
        bcc: draft.bccEmails || undefined,
        subject: draft.subject!,
        bodyHtml: draft.bodyHtml || undefined,
        bodyText: draft.bodyText || undefined,
        threadId: gmailThreadId,
        inReplyTo,
        references,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      { connectionId: draft.connectionId }
    )

    // Mark draft as sent
    await db
      .update(emailDrafts)
      .set({
        status: 'SENT',
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    // Update thread message count if applicable
    if (draft.threadId) {
      const [thread] = await db
        .select({ messageCount: threads.messageCount })
        .from(threads)
        .where(eq(threads.id, draft.threadId))
        .limit(1)

      if (thread) {
        await db
          .update(threads)
          .set({
            messageCount: (thread.messageCount || 0) + 1,
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(threads.id, draft.threadId))
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        messageId: result.id,
        threadId: result.threadId,
      },
    })
  } catch (err) {
    console.error('Failed to send draft:', err)

    // Mark as failed
    await db
      .update(emailDrafts)
      .set({
        status: 'FAILED',
        sendError: err instanceof Error ? err.message : 'Unknown error',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}
