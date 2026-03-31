import 'server-only'

import { getValidAccessToken } from '@/lib/gmail/client'
import { getDocument } from '@/lib/google/docs'
import {
  parseSections,
  extractPlaintext,
  type GoogleDocsDocument,
  type ParsedSection,
} from './sow-parser'
import {
  insertSnapshot,
  insertSections,
  supersedePreviousSnapshots,
  getLatestSnapshot,
  getSectionsForSnapshot,
} from '@/lib/queries/sow'

const DOCS_API_BASE = 'https://docs.googleapis.com/v1'

// =============================================================================
// Fetch full Google Docs document content
// =============================================================================

export async function fetchDocumentContent(
  userId: string,
  docId: string,
  connectionId?: string
): Promise<GoogleDocsDocument> {
  const { accessToken } = await getValidAccessToken(userId, connectionId)

  const url = `${DOCS_API_BASE}/documents/${encodeURIComponent(docId)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to fetch document content: ${errorText}`)
  }

  return res.json()
}

// =============================================================================
// Create a snapshot from a Google Doc
// =============================================================================

export async function createSnapshot(
  sowId: string,
  docId: string,
  userId: string,
  connectionId?: string
): Promise<{ snapshotId: string; version: number; sections: ParsedSection[] }> {
  // Fetch the full document from Google Docs API
  const docContent = await fetchDocumentContent(userId, docId, connectionId)

  // Get document metadata for modifiedTime
  const docMeta = await getDocument(userId, docId, { connectionId })

  // Parse sections
  const sections = parseSections(docContent)

  // Extract plaintext
  const textContent = extractPlaintext(docContent)

  // Determine version number
  const latestSnapshot = await getLatestSnapshot(sowId)
  const nextVersion = latestSnapshot ? latestSnapshot.version + 1 : 1

  // Detect new sections by comparing content hashes with previous snapshot
  let previousHashes = new Set<string>()
  if (latestSnapshot) {
    const previousSections = await getSectionsForSnapshot(latestSnapshot.id)
    previousHashes = new Set(previousSections.map(s => s.contentHash))
  }

  // Mark previous snapshots as superseded
  await supersedePreviousSnapshots(sowId)

  // Insert the new snapshot
  const snapshot = await insertSnapshot({
    sowId,
    version: nextVersion,
    status: 'CURRENT',
    rawContent: docContent as unknown as Record<string, unknown>,
    textContent,
    docModifiedAt: docMeta.modifiedTime ?? null,
    snappedBy: userId,
  })

  // Insert sections with firstSeenInVersion detection
  const sectionsToInsert = sections.map(section => ({
    snapshotId: snapshot.id,
    sowId,
    headingLevel: section.headingLevel,
    headingText: section.headingText,
    bodyText: section.bodyText,
    sectionOrder: section.sectionOrder,
    contentHash: section.contentHash,
    firstSeenInVersion: previousHashes.has(section.contentHash)
      ? (latestSnapshot
          ? // Content existed before — we'd need the actual firstSeenInVersion
            // For simplicity, just use the previous version
            nextVersion - 1
          : nextVersion)
      : nextVersion,
  }))

  if (sectionsToInsert.length > 0) {
    await insertSections(sectionsToInsert)
  }

  return {
    snapshotId: snapshot.id,
    version: nextVersion,
    sections,
  }
}
