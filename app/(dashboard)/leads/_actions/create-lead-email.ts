'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { emailDrafts, leads } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getDefaultGoogleConnectionId, sendEmail } from '@/lib/gmail/client'

const createLeadEmailSchema = z.object({
  leadId: z.string().uuid(),
  toEmail: z.string().email('Valid email required'),
  subject: z.string().min(1, 'Subject is required').max(200),
  bodyHtml: z.string().min(1, 'Body is required'),
  scheduledAt: z.string().datetime().optional().nullable(),
})

export type CreateLeadEmailInput = z.infer<typeof createLeadEmailSchema>

export type CreateLeadEmailResult = {
  success: boolean
  draftId?: string
  error?: string
}

export async function createLeadEmail(
  input: CreateLeadEmailInput
): Promise<CreateLeadEmailResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = createLeadEmailSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const { leadId, toEmail, subject, bodyHtml, scheduledAt } = parsed.data

  // Verify lead exists
  const lead = await db
    .select({ id: leads.id, contactName: leads.contactName })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead[0]) {
    return { success: false, error: 'Lead not found.' }
  }

  // Get user's Gmail connection
  const connectionId = await getDefaultGoogleConnectionId(user.id)
  if (!connectionId) {
    return { success: false, error: 'No Gmail account connected. Please connect Gmail in Settings.' }
  }

  try {
    const now = new Date().toISOString()
    const isFutureSchedule = scheduledAt && new Date(scheduledAt) > new Date()

    const [draft] = await db
      .insert(emailDrafts)
      .values({
        userId: user.id,
        connectionId,
        leadId,
        sendVia: 'gmail',
        composeType: 'new',
        toEmails: [toEmail],
        ccEmails: [],
        bccEmails: [],
        subject,
        bodyHtml,
        bodyText: null,
        attachments: [],
        status: isFutureSchedule ? 'READY' : 'SENDING',
        scheduledAt: scheduledAt ?? now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: emailDrafts.id })

    // Send immediately via Gmail API if not scheduled for the future
    if (!isFutureSchedule) {
      await sendEmail(
        user.id,
        {
          to: [toEmail],
          subject,
          bodyHtml,
        },
        { connectionId }
      )

      await db
        .update(emailDrafts)
        .set({
          status: 'SENT',
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emailDrafts.id, draft.id))
    }

    revalidatePath('/leads/board')

    return { success: true, draftId: draft.id }
  } catch (error) {
    console.error('Failed to send lead email:', error)
    return { success: false, error: 'Unable to send email. Please try again.' }
  }
}
