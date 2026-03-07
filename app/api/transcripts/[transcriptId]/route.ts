import { NextRequest, NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getTranscriptById, classifyTranscriptRecord } from '@/lib/queries/transcripts'

type RouteParams = { params: Promise<{ transcriptId: string }> }

/**
 * GET /api/transcripts/[transcriptId] — Get single transcript with content
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  assertAdmin(user)

  const { transcriptId } = await params
  const transcript = await getTranscriptById(transcriptId)

  if (!transcript) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, transcript })
}

/**
 * PATCH /api/transcripts/[transcriptId] — Classify a transcript
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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
