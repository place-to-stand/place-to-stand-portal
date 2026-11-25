import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authorizeRoute } from '@/lib/auth/guard'
import { getFeedbackReportById } from '@/lib/queries/feedback'
import { TASK_ATTACHMENT_BUCKET } from '@/lib/storage/task-attachment-constants'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const paramsSchema = z.object({ reportId: z.uuid() })

/** Only these were ever stored (the intake checks the bytes). */
const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** A feedback report's screenshot, for the report's sheet. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/storage/feedback-screenshot/[reportId]'>
) {
  const { denied } = await authorizeRoute('feedback.manage')
  if (denied) return denied

  const parsed = paramsSchema.safeParse(await context.params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const report = await getFeedbackReportById(parsed.data.reportId)
  if (
    !report?.screenshotPath ||
    !report.screenshotMimeType ||
    !SCREENSHOT_TYPES.has(report.screenshotMimeType)
  ) {
    return NextResponse.json({ error: 'No screenshot.' }, { status: 404 })
  }

  const { data: file, error } = await getSupabaseServiceClient()
    .storage.from(TASK_ATTACHMENT_BUCKET)
    .download(report.screenshotPath)

  if (error || !file) {
    console.error('Failed to download feedback screenshot', error)
    return NextResponse.json({ error: 'No screenshot.' }, { status: 404 })
  }

  const body = Buffer.from(await file.arrayBuffer())
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': report.screenshotMimeType,
      'Content-Length': body.length.toString(),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
    },
  })
}
