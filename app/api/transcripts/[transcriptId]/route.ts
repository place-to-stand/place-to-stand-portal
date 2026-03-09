import { NextRequest, NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { getTranscriptById, classifyTranscriptRecord } from '@/lib/queries/transcripts'
import { getValidAccessToken } from '@/lib/gmail/client'
import { fetchDocContent, fetchDocHtml } from '@/lib/google/transcript-discovery'

type RouteParams = { params: Promise<{ transcriptId: string }> }

/**
 * GET /api/transcripts/[transcriptId] — Get single transcript with content (fetched from Google Drive)
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const user = await requireUser()
  assertAdmin(user)

  const { transcriptId } = await params
  const transcript = await getTranscriptById(transcriptId)

  if (!transcript) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch content fresh from Google Drive (HTML for rendering, text for AI/fallback)
  let content: string | null = null
  let contentHtml: string | null = null
  if (transcript.driveFileId) {
    try {
      const { accessToken } = await getValidAccessToken(user.id)
      const [text, html] = await Promise.all([
        fetchDocContent(accessToken, transcript.driveFileId),
        fetchDocHtml(accessToken, transcript.driveFileId),
      ])
      content = text
      contentHtml = html
    } catch {
      // Content unavailable — return transcript without it
    }
  }

  return NextResponse.json({ ok: true, transcript: { ...transcript, content, contentHtml } })
}

/**
 * PATCH /api/transcripts/[transcriptId] — Classify a transcript
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const user = await requireUser()
  assertAdmin(user)

  const { transcriptId } = await params
  const transcript = await getTranscriptById(transcriptId)

  if (!transcript) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { classification, clientId, projectId, leadId } = body

  await classifyTranscriptRecord(transcriptId, user.id, {
    clientId,
    projectId,
    leadId,
    classification,
  })

  return NextResponse.json({ ok: true })
}
