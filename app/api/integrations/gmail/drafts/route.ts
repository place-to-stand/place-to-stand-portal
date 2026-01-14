import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, isNull, desc } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailDrafts } from '@/lib/db/schema'
import { getDefaultGoogleConnectionId } from '@/lib/gmail/client'

// Email validation - allows empty arrays since drafts may be incomplete
const emailArraySchema = z
  .array(z.string())
  .default([])
  .transform(emails =>
    // Filter out empty strings and validate remaining as emails
    emails.filter(e => e.trim() !== '')
  )
  .refine(
    emails => emails.every(e => z.string().email().safeParse(e).success),
    { message: 'Invalid email address in list' }
  )

const createDraftSchema = z.object({
  connectionId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  composeType: z.enum(['new', 'reply', 'reply_all', 'forward']),
  inReplyToMessageId: z.string().optional(),
  toEmails: emailArraySchema,
  ccEmails: emailArraySchema,
  bccEmails: emailArraySchema,
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
})

/**
 * GET /api/integrations/gmail/drafts
 * List all drafts for the current user
 */
export async function GET() {
  const user = await requireUser()

  const drafts = await db
    .select()
    .from(emailDrafts)
    .where(and(eq(emailDrafts.userId, user.id), isNull(emailDrafts.deletedAt)))
    .orderBy(desc(emailDrafts.updatedAt))

  return NextResponse.json({ ok: true, drafts })
}

/**
 * POST /api/integrations/gmail/drafts
 * Create a new draft
 */
export async function POST(request: Request) {
  const user = await requireUser()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Get connection ID
  let connectionId = data.connectionId
  if (!connectionId) {
    connectionId = (await getDefaultGoogleConnectionId(user.id)) ?? undefined
  }

  if (!connectionId) {
    return NextResponse.json(
      { error: 'No Gmail connection found' },
      { status: 400 }
    )
  }

  try {
    const [draft] = await db
      .insert(emailDrafts)
      .values({
        userId: user.id,
        connectionId,
        threadId: data.threadId,
        composeType: data.composeType,
        inReplyToMessageId: data.inReplyToMessageId,
        toEmails: data.toEmails,
        ccEmails: data.ccEmails,
        bccEmails: data.bccEmails,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText,
        clientId: data.clientId,
        projectId: data.projectId,
        status: 'COMPOSING',
        attachments: [],
      })
      .returning()

    return NextResponse.json({ ok: true, draft })
  } catch (err) {
    console.error('Failed to create draft:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to create draft' },
      { status: 500 }
    )
  }
}
