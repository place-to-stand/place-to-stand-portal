import { NextRequest, NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { getTranscriptById, updateTranscript } from '@/lib/queries/transcripts'
import { classifyTranscript } from '@/lib/ai/transcript-classification'
import { fetchActiveClientsForClassification, fetchActiveProjectsForClassification, fetchActiveLeadsForClassification } from '@/lib/data/transcripts'
import { getValidAccessToken } from '@/lib/gmail/client'
import { fetchDocContent, extractParticipantNames } from '@/lib/google/transcript-discovery'

type RouteParams = { params: Promise<{ transcriptId: string }> }

/**
 * GET — Read cached AI analysis (no side effects)
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

  return NextResponse.json({
    ok: true,
    analyzed: !!transcript.aiAnalyzedAt,
    suggestion: transcript.aiAnalyzedAt
      ? {
          clientId: transcript.aiSuggestedClientId,
          clientName: transcript.aiSuggestedClientName,
          projectId: transcript.aiSuggestedProjectId,
          projectName: transcript.aiSuggestedProjectName,
          leadId: transcript.aiSuggestedLeadId,
          leadName: transcript.aiSuggestedLeadName,
          confidence: transcript.aiConfidence,
          analyzedAt: transcript.aiAnalyzedAt,
        }
      : null,
  })
}

/**
 * POST — Run AI analysis (or return cache; { force: true } to re-analyze)
 */
export async function POST(
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

  const body = await request.json().catch(() => ({}))
  const force = body.force === true

  // Cache hit
  if (transcript.aiAnalyzedAt && !force) {
    return NextResponse.json({
      ok: true,
      cached: true,
      suggestion: {
        clientId: transcript.aiSuggestedClientId,
        clientName: transcript.aiSuggestedClientName,
        projectId: transcript.aiSuggestedProjectId,
        projectName: transcript.aiSuggestedProjectName,
        leadId: transcript.aiSuggestedLeadId,
        leadName: transcript.aiSuggestedLeadName,
        confidence: transcript.aiConfidence,
        analyzedAt: transcript.aiAnalyzedAt,
      },
    })
  }

  // Fetch content from Google Drive for analysis
  let content: string | null = null
  if (transcript.driveFileId) {
    try {
      const { accessToken } = await getValidAccessToken(user.id)
      content = await fetchDocContent(accessToken, transcript.driveFileId)
    } catch {
      // Proceed without content — AI can still classify by title
    }
  }

  const participantNames = extractParticipantNames(content)

  // Run AI classification
  const [clients, projects, leads] = await Promise.all([
    fetchActiveClientsForClassification(),
    fetchActiveProjectsForClassification(),
    fetchActiveLeadsForClassification(),
  ])

  const result = await classifyTranscript({
    title: transcript.title,
    participantNames,
    contentSnippet: (content ?? '').slice(0, 2000),
    clients,
    projects,
    leads,
  })

  // Store top match — pick highest confidence overall
  const topClient = result.clientMatches[0]
  const topLead = result.leadMatches[0]
  const topConfidence =
    Math.max(topClient?.confidence ?? 0, topLead?.confidence ?? 0) || null

  await updateTranscript(transcriptId, {
    aiSuggestedClientId: topClient?.clientId ?? null,
    aiSuggestedClientName: topClient?.clientName ?? null,
    aiSuggestedProjectId: topClient?.projectId ?? null,
    aiSuggestedProjectName: topClient?.projectName ?? null,
    aiSuggestedLeadId: topLead?.leadId ?? null,
    aiSuggestedLeadName: topLead?.leadName ?? null,
    aiConfidence: topConfidence?.toString() ?? null,
    aiAnalyzedAt: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    cached: false,
    suggestion: {
      clientId: topClient?.clientId ?? null,
      clientName: topClient?.clientName ?? null,
      projectId: topClient?.projectId ?? null,
      projectName: topClient?.projectName ?? null,
      leadId: topLead?.leadId ?? null,
      leadName: topLead?.leadName ?? null,
      confidence: topConfidence,
      analyzedAt: new Date().toISOString(),
    },
    clientMatches: result.clientMatches,
    leadMatches: result.leadMatches,
  })
}
