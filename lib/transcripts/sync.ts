import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { transcripts, oauthConnections } from '@/lib/db/schema'
import { discoverTranscriptsFromDrive } from '@/lib/google/transcript-discovery'
import type { DiscoveredTranscript } from '@/lib/google/transcript-discovery'

// =============================================================================
// Types
// =============================================================================

export type TranscriptSyncResult = {
  discovered: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

// =============================================================================
// Sync Orchestrator
// =============================================================================

/**
 * Sync transcripts from Google Drive for a specific user.
 * Discovers documents, deduplicates against existing records, and upserts.
 */
export async function syncTranscriptsForUser(
  userId: string,
  options?: { connectionId?: string }
): Promise<TranscriptSyncResult> {
  const result: TranscriptSyncResult = {
    discovered: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  let discovered: DiscoveredTranscript[]
  try {
    discovered = await discoverTranscriptsFromDrive(userId, options)
    result.discovered = discovered.length
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown discovery error'
    console.error('[Transcript Sync] Discovery failed:', msg)
    result.errors.push(msg)
    return result
  }

  if (discovered.length === 0) {
    await updateSyncState(userId, options?.connectionId)
    return result
  }

  // Get existing transcripts by driveFileId for dedup
  const driveFileIds = discovered
    .map(d => d.driveFileId)
    .filter(Boolean)

  const existingRecords = driveFileIds.length > 0
    ? await db
        .select({
          id: transcripts.id,
          driveFileId: transcripts.driveFileId,
          title: transcripts.title,
        })
        .from(transcripts)
        .where(isNull(transcripts.deletedAt))
    : []

  const existingByDriveId = new Map(
    existingRecords
      .filter(r => r.driveFileId)
      .map(r => [r.driveFileId!, r])
  )

  // Process each discovered document
  for (const doc of discovered) {
    try {
      const existing = existingByDriveId.get(doc.driveFileId)

      if (existing) {
        // Document already exists — check if it needs updating
        if (doc.title !== existing.title || doc.content) {
          await db
            .update(transcripts)
            .set({
              title: doc.title,
              content: doc.content,
              participantNames: doc.participantNames,
              meetingDate: doc.meetingDate,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(transcripts.id, existing.id))
          result.updated++
        } else {
          result.skipped++
        }
      } else {
        // New document — insert
        await db.insert(transcripts).values({
          title: doc.title,
          content: doc.content,
          source: doc.source,
          driveFileId: doc.driveFileId,
          driveFileUrl: doc.driveFileUrl,
          meetingDate: doc.meetingDate,
          participantNames: doc.participantNames,
          participantEmails: [],
          classification: 'UNCLASSIFIED',
          syncedBy: userId,
        })
        result.created++
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Transcript Sync] Failed to process ${doc.title}:`, msg)
      result.errors.push(`${doc.title}: ${msg}`)
    }
  }

  // Update sync state
  await updateSyncState(userId, options?.connectionId)

  console.log(
    `[Transcript Sync] Complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`
  )

  return result
}

async function updateSyncState(
  userId: string,
  connectionId?: string
): Promise<void> {
  try {
    const conditions = [
      eq(oauthConnections.userId, userId),
      eq(oauthConnections.provider, 'GOOGLE'),
      eq(oauthConnections.status, 'ACTIVE'),
      isNull(oauthConnections.deletedAt),
    ]

    if (connectionId) {
      conditions.push(eq(oauthConnections.id, connectionId))
    }

    const [conn] = await db
      .select({ id: oauthConnections.id, syncState: oauthConnections.syncState })
      .from(oauthConnections)
      .where(and(...conditions))
      .limit(1)

    if (conn) {
      const currentState = (conn.syncState ?? {}) as Record<string, unknown>
      await db
        .update(oauthConnections)
        .set({
          syncState: {
            ...currentState,
            lastTranscriptSyncAt: new Date().toISOString(),
          },
        })
        .where(eq(oauthConnections.id, conn.id))
    }
  } catch (error) {
    console.error('[Transcript Sync] Failed to update sync state:', error)
  }
}
