import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailDrafts } from '@/lib/db/schema'

// Email validation for updates - optional but validated when present
const optionalEmailArraySchema = z
  .array(z.string())
  .optional()
  .transform(emails =>
    emails?.filter(e => e.trim() !== '')
  )
  .refine(
    emails => !emails || emails.every(e => z.string().email().safeParse(e).success),
    { message: 'Invalid email address in list' }
  )

const updateDraftSchema = z.object({
  toEmails: optionalEmailArraySchema,
  ccEmails: optionalEmailArraySchema,
  bccEmails: optionalEmailArraySchema,
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: z.enum(['COMPOSING', 'READY']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

type RouteParams = { params: Promise<{ draftId: string }> }

/**
 * GET /api/integrations/gmail/drafts/[draftId]
 * Get a specific draft
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireUser()
  const { draftId } = await params

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

  return NextResponse.json({ ok: true, draft })
}

/**
 * PATCH /api/integrations/gmail/drafts/[draftId]
 * Update a draft (auto-save)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await requireUser()
  const { draftId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Verify ownership
  const [existing] = await db
    .select({ id: emailDrafts.id })
    .from(emailDrafts)
    .where(
      and(
        eq(emailDrafts.id, draftId),
        eq(emailDrafts.userId, user.id),
        isNull(emailDrafts.deletedAt)
      )
    )
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  }

  if (data.toEmails !== undefined) updates.toEmails = data.toEmails
  if (data.ccEmails !== undefined) updates.ccEmails = data.ccEmails
  if (data.bccEmails !== undefined) updates.bccEmails = data.bccEmails
  if (data.subject !== undefined) updates.subject = data.subject
  if (data.bodyHtml !== undefined) updates.bodyHtml = data.bodyHtml
  if (data.bodyText !== undefined) updates.bodyText = data.bodyText
  if (data.clientId !== undefined) updates.clientId = data.clientId
  if (data.projectId !== undefined) updates.projectId = data.projectId
  if (data.status !== undefined) updates.status = data.status
  if (data.scheduledAt !== undefined) updates.scheduledAt = data.scheduledAt

  try {
    const [draft] = await db
      .update(emailDrafts)
      .set(updates)
      .where(eq(emailDrafts.id, draftId))
      .returning()

    return NextResponse.json({ ok: true, draft })
  } catch (err) {
    console.error('Failed to update draft:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to update draft' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/gmail/drafts/[draftId]
 * Soft-delete a draft
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser()
  const { draftId } = await params

  // Verify ownership
  const [existing] = await db
    .select({ id: emailDrafts.id })
    .from(emailDrafts)
    .where(
      and(
        eq(emailDrafts.id, draftId),
        eq(emailDrafts.userId, user.id),
        isNull(emailDrafts.deletedAt)
      )
    )
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  try {
    await db
      .update(emailDrafts)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Failed to delete draft:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to delete draft' },
      { status: 500 }
    )
  }
}
