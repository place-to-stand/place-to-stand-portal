import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireStaffUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getTaskAttachmentForDownload } from '@/lib/queries/task-attachments'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import { HttpError } from '@/lib/errors/http'
import { buildContentDispositionHeader } from '@/lib/http/content-disposition'

/** Types a browser may render in place; anything else is downloaded. */
const INLINE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const paramsSchema = z.object({
  attachmentId: z.string().uuid(),
})

export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/storage/task-attachment/[attachmentId]'>
) {
  const actor = await requireStaffUser()
  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const attachmentId = parsedParams.data.attachmentId

  const supabase = getSupabaseServiceClient()

  let attachment
  try {
    attachment = await getTaskAttachmentForDownload(actor, attachmentId)
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error('Failed to load attachment metadata', error)
    return NextResponse.json(
      { error: 'Unable to load attachment.' },
      { status: 500 }
    )
  }

  await ensureTaskAttachmentBucket(supabase)

  const { data: file, error: downloadError } = await supabase.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .download(attachment.storagePath)

  if (downloadError || !file) {
    console.error('Failed to download attachment', downloadError)
    return NextResponse.json(
      { error: 'Attachment not found.' },
      { status: 404 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileBuffer = Buffer.from(arrayBuffer)

  // Rows written before the mime allowlist may carry any type: only known
  // image/PDF types render inline, the rest download as opaque bytes.
  const inline = INLINE_MIME_TYPES.has(attachment.mimeType)

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': inline ? attachment.mimeType : 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      'Content-Disposition': buildContentDispositionHeader({
        disposition: inline ? 'inline' : 'attachment',
        filename: attachment.originalName,
      }),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
    },
  })
}
