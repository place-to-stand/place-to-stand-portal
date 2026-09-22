import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  deleteAttachmentObject,
  resolveAttachmentExtension,
} from '@/lib/storage/task-attachments'
import {
  ACCEPTED_TASK_ATTACHMENT_MIME_TYPES,
  MAX_TASK_ATTACHMENT_FILE_SIZE,
  TASK_ATTACHMENT_BUCKET,
} from '@/lib/storage/task-attachment-constants'
import {
  ensureTaskAttachmentBucket,
  generatePendingAttachmentPath,
  isPendingAttachmentPath,
} from '@/lib/storage/task-attachments'

const uploadPayloadSchema = z.object({
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
})

const deletePayloadSchema = z.object({
  path: z.string().min(1),
})

/**
 * Reserves a pending storage path and returns a one-time signed upload token.
 * The browser uploads the file straight to Supabase Storage with it, because
 * Vercel rejects function request bodies over 4.5MB with a 413 long before
 * this handler could run. The bucket's own size and MIME limits (kept in sync
 * by `ensureTaskAttachmentBucket`) enforce what the client claims here.
 */
export async function POST(request: Request) {
  const actor = await requireUser()
  const payload = await request.json().catch(() => null)
  const parsed = uploadPayloadSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { mimeType, fileSize } = parsed.data

  if (
    !ACCEPTED_TASK_ATTACHMENT_MIME_TYPES.includes(
      mimeType as (typeof ACCEPTED_TASK_ATTACHMENT_MIME_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: 'Unsupported file type.' },
      { status: 400 }
    )
  }

  if (fileSize > MAX_TASK_ATTACHMENT_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Attachment is too large.' },
      { status: 400 }
    )
  }

  const extension = resolveAttachmentExtension(mimeType)

  if (!extension) {
    return NextResponse.json(
      { error: 'Unable to determine file extension.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServiceClient()

  await ensureTaskAttachmentBucket(supabase)

  const path = generatePendingAttachmentPath({ actorId: actor.id, extension })
  const { data, error } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Failed to create task attachment upload URL', error)
    return NextResponse.json(
      { error: 'Unable to upload attachment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ path, token: data.token })
}

export async function DELETE(request: Request) {
  const actor = await requireUser()
  const payload = await request.json().catch(() => null)
  const parsed = deletePayloadSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { path } = parsed.data

  if (!isPendingAttachmentPath(path, actor.id) && actor.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'You cannot remove this attachment.' },
      { status: 403 }
    )
  }

  const supabase = getSupabaseServiceClient()

  try {
    await deleteAttachmentObject({ client: supabase, path })
  } catch (error) {
    console.error('Failed to remove pending attachment', error)
    return NextResponse.json(
      { error: 'Unable to remove attachment.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
