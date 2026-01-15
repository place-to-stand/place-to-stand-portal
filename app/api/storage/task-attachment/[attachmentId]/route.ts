import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchQuery } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'

import { requireUser } from '@/lib/auth/session'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getTaskAttachmentForDownload } from '@/lib/queries/task-attachments'
import { ensureTaskAttachmentBucket } from '@/lib/storage/task-attachments'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import { HttpError } from '@/lib/errors/http'
import { buildContentDispositionHeader } from '@/lib/http/content-disposition'
import { CONVEX_FLAGS } from '@/lib/feature-flags'

// Convex ID validation (base32-like format)
const convexIdRegex = /^[a-z0-9]+$/

const paramsSchema = z.object({
  attachmentId: z.string().refine(
    (val) => {
      // Accept UUID for Supabase or Convex ID format
      const isUuid = z.string().uuid().safeParse(val).success
      const isConvexId = convexIdRegex.test(val)
      return isUuid || isConvexId
    },
    { message: 'Invalid attachment ID format' }
  ),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ attachmentId: string }> }
) {
  const actor = await requireUser()
  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const attachmentId = parsedParams.data.attachmentId

  // Use Convex Storage if enabled
  if (CONVEX_FLAGS.STORAGE) {
    try {
      const { api } = await import('@/convex/_generated/api')
      const attachmentUrl = await fetchQuery(
        api.storage.attachments.getAttachmentUrl,
        { attachmentId: attachmentId as unknown as import('@/convex/_generated/dataModel').Id<'taskAttachments'> },
        { token: await convexAuthNextjsToken() }
      )

      if (!attachmentUrl) {
        return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
      }

      // Redirect to the Convex storage URL
      return NextResponse.redirect(attachmentUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      })
    } catch (error) {
      console.error('Failed to get Convex attachment URL', error)
      return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 })
    }
  }

  // Supabase Storage (default)
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

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType || 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      'Content-Disposition': buildContentDispositionHeader({
        disposition: 'inline',
        filename: attachment.originalName,
      }),
    },
  })
}
