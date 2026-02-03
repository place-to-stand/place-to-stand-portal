import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, lte } from 'drizzle-orm'
import { timingSafeEqual } from 'crypto'

import { db } from '@/lib/db'
import { emailDrafts, threads } from '@/lib/db/schema'
import { sendEmail, getMessage } from '@/lib/gmail/client'
import { extractThreadingHeaders } from '@/lib/gmail/threading'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  downloadAttachmentsForSend,
  type EmailAttachmentMetadata,
} from '@/lib/storage/email-attachments'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  logScheduledCronStart,
  logScheduledCronComplete,
  logScheduledDraftProcessing,
} from '@/lib/logging/email'

/**
 * Timing-safe string comparison to prevent timing attacks on secret validation
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to prevent timing attacks based on early return
    timingSafeEqual(Buffer.from(a), Buffer.from(a))
    return false
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * GET /api/cron/email-scheduled
 * Process and send scheduled emails that are ready
 *
 * Runs every 5 minutes via Vercel cron (see vercel.json)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Verify cron secret with timing-safe comparison
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const providedToken = authHeader?.replace('Bearer ', '') || ''

  if (!cronSecret || !safeCompare(providedToken, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all scheduled drafts that are ready to send
  const now = new Date().toISOString()
  const scheduledDrafts = await db
    .select()
    .from(emailDrafts)
    .where(
      and(
        eq(emailDrafts.status, 'READY'),
        isNull(emailDrafts.deletedAt),
        lte(emailDrafts.scheduledAt, now)
      )
    )
    .limit(50) // Process in batches to avoid timeout

  // Log cron job start
  logScheduledCronStart(scheduledDrafts.length)

  const results: Array<{
    draftId: string
    userId: string
    status: 'sent' | 'failed'
    error?: string
  }> = []

  for (const draft of scheduledDrafts) {
    const logContext = {
      userId: draft.userId,
      draftId: draft.id,
      threadId: draft.threadId || undefined,
      recipientCount:
        (draft.toEmails?.length || 0) +
        (draft.ccEmails?.length || 0) +
        (draft.bccEmails?.length || 0),
      isReply: !!draft.inReplyToMessageId,
      isScheduled: true,
    }

    logScheduledDraftProcessing('start', logContext)

    try {
      // Validate required fields
      if (!draft.toEmails || draft.toEmails.length === 0) {
        throw new Error('No recipients')
      }
      if (!draft.subject?.trim()) {
        throw new Error('No subject')
      }

      // Mark as sending
      await db
        .update(emailDrafts)
        .set({
          status: 'SENDING',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDrafts.id, draft.id))

      // Get threading info if this is a reply
      let gmailThreadId: string | undefined
      let inReplyTo: string | undefined
      let references: string[] | undefined

      if (draft.inReplyToMessageId && draft.connectionId) {
        const originalMessage = await getMessage(draft.userId, draft.inReplyToMessageId, {
          connectionId: draft.connectionId,
        })
        const threading = extractThreadingHeaders(originalMessage)
        gmailThreadId = threading.gmailThreadId
        inReplyTo = threading.inReplyTo
        references = threading.references
      }

      // Download attachments from storage in parallel
      const draftAttachments = draft.attachments as EmailAttachmentMetadata[]
      const supabase = getSupabaseServiceClient()
      const attachments = await downloadAttachmentsForSend({
        client: supabase,
        attachments: draftAttachments,
      })

      // Send the email via Gmail
      await sendEmail(
        draft.userId,
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
        { connectionId: draft.connectionId ?? undefined }
      )

      // Mark draft as sent
      await db
        .update(emailDrafts)
        .set({
          status: 'SENT',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDrafts.id, draft.id))

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

      // Track scheduled email sent
      await captureServerEvent({
        event: 'email_sent',
        distinctId: draft.userId,
        properties: {
          recipient_count:
            draft.toEmails.length +
            (draft.ccEmails?.length || 0) +
            (draft.bccEmails?.length || 0),
          has_attachments: attachments.length > 0,
          attachment_count: attachments.length,
          is_reply: !!draft.inReplyToMessageId,
          is_scheduled: true,
          has_client_link: !!draft.clientId,
          has_project_link: !!draft.projectId,
        },
      })

      logScheduledDraftProcessing('success', {
        ...logContext,
        attachmentCount: attachments.length,
      })

      results.push({
        draftId: draft.id,
        userId: draft.userId,
        status: 'sent',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      logScheduledDraftProcessing('failed', logContext, errorMessage)

      // Mark as failed
      await db
        .update(emailDrafts)
        .set({
          status: 'FAILED',
          sendError: errorMessage,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDrafts.id, draft.id))

      results.push({
        draftId: draft.id,
        userId: draft.userId,
        status: 'failed',
        error: errorMessage,
      })
    }
  }

  // Log cron job completion
  const sent = results.filter(r => r.status === 'sent').length
  const failed = results.filter(r => r.status === 'failed').length
  logScheduledCronComplete({
    processed: scheduledDrafts.length,
    sent,
    failed,
    duration_ms: Date.now() - startTime,
  })

  return NextResponse.json({
    processed: scheduledDrafts.length,
    sent,
    failed,
    results,
  })
}
