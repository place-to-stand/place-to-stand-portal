import 'server-only'

import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { transcripts } from '@/lib/db/schema'

// =============================================================================
// Types (list queries exclude content column)
// =============================================================================

export type TranscriptSummary = {
  id: string
  title: string
  source: string
  driveFileId: string | null
  driveFileUrl: string | null
  meetingDate: string | null
  durationMinutes: number | null
  participantNames: string[]
  participantEmails: string[]
  classification: string
  clientId: string | null
  projectId: string | null
  leadId: string | null
  classifiedBy: string | null
  classifiedAt: string | null
  aiSuggestedClientId: string | null
  aiSuggestedClientName: string | null
  aiSuggestedProjectId: string | null
  aiSuggestedProjectName: string | null
  aiSuggestedLeadId: string | null
  aiSuggestedLeadName: string | null
  aiConfidence: string | null
  aiAnalyzedAt: string | null
  syncedBy: string | null
  createdAt: string
  updatedAt: string
}

export type TranscriptDetail = TranscriptSummary & {
  content: string | null
}

export type TranscriptForClient = {
  id: string
  title: string
  meetingDate: string | null
  durationMinutes: number | null
  participantNames: string[]
  driveFileUrl: string | null
}

export type TranscriptForLead = TranscriptForClient

// Columns to select for list views (excludes content)
const summaryColumns = {
  id: transcripts.id,
  title: transcripts.title,
  source: transcripts.source,
  driveFileId: transcripts.driveFileId,
  driveFileUrl: transcripts.driveFileUrl,
  meetingDate: transcripts.meetingDate,
  durationMinutes: transcripts.durationMinutes,
  participantNames: transcripts.participantNames,
  participantEmails: transcripts.participantEmails,
  classification: transcripts.classification,
  clientId: transcripts.clientId,
  projectId: transcripts.projectId,
  leadId: transcripts.leadId,
  classifiedBy: transcripts.classifiedBy,
  classifiedAt: transcripts.classifiedAt,
  aiSuggestedClientId: transcripts.aiSuggestedClientId,
  aiSuggestedClientName: transcripts.aiSuggestedClientName,
  aiSuggestedProjectId: transcripts.aiSuggestedProjectId,
  aiSuggestedProjectName: transcripts.aiSuggestedProjectName,
  aiSuggestedLeadId: transcripts.aiSuggestedLeadId,
  aiSuggestedLeadName: transcripts.aiSuggestedLeadName,
  aiConfidence: transcripts.aiConfidence,
  aiAnalyzedAt: transcripts.aiAnalyzedAt,
  syncedBy: transcripts.syncedBy,
  createdAt: transcripts.createdAt,
  updatedAt: transcripts.updatedAt,
} as const

// =============================================================================
// Queries
// =============================================================================

export async function listTranscripts(options: {
  classification?: string
  clientId?: string
  projectId?: string
  leadId?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<TranscriptSummary[]> {
  const conditions = [isNull(transcripts.deletedAt)]

  if (options.classification) {
    conditions.push(
      eq(transcripts.classification, options.classification as 'UNCLASSIFIED' | 'CLASSIFIED' | 'DISMISSED')
    )
  }
  if (options.clientId) {
    conditions.push(eq(transcripts.clientId, options.clientId))
  }
  if (options.projectId) {
    conditions.push(eq(transcripts.projectId, options.projectId))
  }
  if (options.leadId) {
    conditions.push(eq(transcripts.leadId, options.leadId))
  }
  if (options.search) {
    const searchTerm = `%${options.search}%`
    conditions.push(
      or(
        ilike(transcripts.title, searchTerm),
        sql`array_to_string(${transcripts.participantNames}, ', ') ILIKE ${searchTerm}`
      )!
    )
  }

  return db
    .select(summaryColumns)
    .from(transcripts)
    .where(and(...conditions))
    .orderBy(desc(transcripts.meetingDate), desc(transcripts.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0)
}

export async function getTranscriptCounts(): Promise<{
  unclassified: number
  classified: number
  dismissed: number
}> {
  const results = await db
    .select({
      classification: transcripts.classification,
      count: count(),
    })
    .from(transcripts)
    .where(isNull(transcripts.deletedAt))
    .groupBy(transcripts.classification)

  const counts = { unclassified: 0, classified: 0, dismissed: 0 }
  for (const row of results) {
    if (row.classification === 'UNCLASSIFIED') counts.unclassified = row.count
    else if (row.classification === 'CLASSIFIED') counts.classified = row.count
    else if (row.classification === 'DISMISSED') counts.dismissed = row.count
  }
  return counts
}

export async function getTranscriptById(
  id: string
): Promise<TranscriptDetail | null> {
  const [result] = await db
    .select({
      ...summaryColumns,
      content: transcripts.content,
    })
    .from(transcripts)
    .where(and(eq(transcripts.id, id), isNull(transcripts.deletedAt)))
    .limit(1)

  return result ?? null
}

export async function updateTranscript(
  id: string,
  data: Partial<{
    title: string
    content: string | null
    classification: 'UNCLASSIFIED' | 'CLASSIFIED' | 'DISMISSED'
    clientId: string | null
    projectId: string | null
    leadId: string | null
    classifiedBy: string | null
    classifiedAt: string | null
    aiSuggestedClientId: string | null
    aiSuggestedClientName: string | null
    aiSuggestedProjectId: string | null
    aiSuggestedProjectName: string | null
    aiSuggestedLeadId: string | null
    aiSuggestedLeadName: string | null
    aiConfidence: string | null
    aiAnalyzedAt: string | null
  }>
): Promise<void> {
  await db
    .update(transcripts)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transcripts.id, id))
}

/**
 * Classify a transcript with mutual exclusivity enforcement.
 * Setting leadId clears clientId/projectId and vice versa.
 */
export async function classifyTranscriptRecord(
  id: string,
  userId: string,
  data: {
    clientId?: string | null
    projectId?: string | null
    leadId?: string | null
    classification?: 'CLASSIFIED' | 'DISMISSED'
  }
): Promise<void> {
  const now = new Date().toISOString()

  if (data.classification === 'DISMISSED') {
    // Dismiss: clear all links
    await updateTranscript(id, {
      classification: 'DISMISSED',
      clientId: null,
      projectId: null,
      leadId: null,
      classifiedBy: userId,
      classifiedAt: now,
    })
    return
  }

  // Enforce mutual exclusivity
  const update: Parameters<typeof updateTranscript>[1] = {
    classification: 'CLASSIFIED',
    classifiedBy: userId,
    classifiedAt: now,
  }

  if (data.leadId) {
    // Lead track: clear client/project
    update.leadId = data.leadId
    update.clientId = null
    update.projectId = null
  } else {
    // Client track: clear lead
    update.clientId = data.clientId ?? null
    update.projectId = data.projectId ?? null
    update.leadId = null
  }

  await updateTranscript(id, update)
}

export async function getTranscriptsForClient(
  clientId: string,
  options?: { limit?: number }
): Promise<TranscriptForClient[]> {
  return db
    .select({
      id: transcripts.id,
      title: transcripts.title,
      meetingDate: transcripts.meetingDate,
      durationMinutes: transcripts.durationMinutes,
      participantNames: transcripts.participantNames,
      driveFileUrl: transcripts.driveFileUrl,
    })
    .from(transcripts)
    .where(
      and(
        eq(transcripts.clientId, clientId),
        eq(transcripts.classification, 'CLASSIFIED'),
        isNull(transcripts.deletedAt)
      )
    )
    .orderBy(desc(transcripts.meetingDate), desc(transcripts.createdAt))
    .limit(options?.limit ?? 5)
}

export async function getTranscriptsForLead(
  leadId: string,
  options?: { limit?: number }
): Promise<TranscriptForLead[]> {
  return db
    .select({
      id: transcripts.id,
      title: transcripts.title,
      meetingDate: transcripts.meetingDate,
      durationMinutes: transcripts.durationMinutes,
      participantNames: transcripts.participantNames,
      driveFileUrl: transcripts.driveFileUrl,
    })
    .from(transcripts)
    .where(
      and(
        eq(transcripts.leadId, leadId),
        eq(transcripts.classification, 'CLASSIFIED'),
        isNull(transcripts.deletedAt)
      )
    )
    .orderBy(desc(transcripts.meetingDate), desc(transcripts.createdAt))
    .limit(options?.limit ?? 10)
}

export async function getTranscriptCountForClient(
  clientId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(transcripts)
    .where(
      and(
        eq(transcripts.clientId, clientId),
        eq(transcripts.classification, 'CLASSIFIED'),
        isNull(transcripts.deletedAt)
      )
    )
  return result?.count ?? 0
}
