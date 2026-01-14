import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'

import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { emailDrafts } from '@/lib/db/schema'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  uploadEmailAttachment,
  deleteEmailAttachment,
  type EmailAttachmentMetadata,
} from '@/lib/storage/email-attachments'
import {
  MAX_EMAIL_ATTACHMENT_FILE_SIZE,
  ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES,
} from '@/lib/storage/email-attachment-constants'

type Params = Promise<{ draftId: string }>

/**
 * POST /api/integrations/gmail/drafts/[draftId]/attachments
 * Upload an attachment to a draft
 */
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { draftId } = await params

  // Verify draft ownership
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

  // Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_EMAIL_ATTACHMENT_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_EMAIL_ATTACHMENT_FILE_SIZE / (1024 * 1024)}MB` },
      { status: 400 }
    )
  }

  // Validate file type
  const acceptedTypes: readonly string[] = ACCEPTED_EMAIL_ATTACHMENT_MIME_TYPES
  if (!acceptedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseServiceClient()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to storage
    const metadata = await uploadEmailAttachment({
      client: supabase,
      draftId,
      file: buffer,
      filename: file.name,
    })

    // Update draft attachments
    const existingAttachments = (draft.attachments as EmailAttachmentMetadata[]) || []
    const updatedAttachments = [...existingAttachments, metadata]

    await db
      .update(emailDrafts)
      .set({
        attachments: updatedAttachments,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    return NextResponse.json({
      ok: true,
      attachment: metadata,
      attachments: updatedAttachments,
    })
  } catch (err) {
    console.error('Failed to upload attachment:', err)
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/gmail/drafts/[draftId]/attachments
 * Remove an attachment from a draft
 * Body: { storageKey: string }
 */
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { draftId } = await params
  const body = await request.json()
  const { storageKey } = body

  if (!storageKey) {
    return NextResponse.json({ error: 'storageKey required' }, { status: 400 })
  }

  // Verify draft ownership
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

  try {
    const supabase = getSupabaseServiceClient()

    // Delete from storage
    await deleteEmailAttachment({ client: supabase, storageKey })

    // Update draft attachments
    const existingAttachments = (draft.attachments as EmailAttachmentMetadata[]) || []
    const updatedAttachments = existingAttachments.filter(
      a => a.storageKey !== storageKey
    )

    await db
      .update(emailDrafts)
      .set({
        attachments: updatedAttachments,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailDrafts.id, draftId))

    return NextResponse.json({
      ok: true,
      attachments: updatedAttachments,
    })
  } catch (err) {
    console.error('Failed to delete attachment:', err)
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}
