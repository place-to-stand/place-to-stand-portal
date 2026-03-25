'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { extractDocIdFromUrl, getDocument } from '@/lib/google/docs'
import { createSnapshot } from '@/lib/google/sow-snapshot'
import { parseRichContent } from '@/lib/google/sow-parser'
import type { RichBlock } from '@/lib/google/sow-parser-types'
import type { GoogleDocsDocument } from '@/lib/google/sow-parser-types'
import {
  getActiveSowByProjectId,
  getActiveSowsByProjectId,
  getSowById,
  insertSow,
  softDeleteSow,
  getCurrentSnapshot,
  getSectionsForSnapshot,
  updateSowStatus as updateSowStatusQuery,
} from '@/lib/queries/sow'

// ---------------------------------------------------------------------------
// Link a Google Doc SOW to a project
// ---------------------------------------------------------------------------

const linkSowSchema = z.object({
  projectId: z.string().uuid(),
  googleDocUrl: z.string().url(),
})

type LinkSowResult =
  | { data: { sowId: string; snapshotVersion: number } }
  | { error: string }

export async function linkSow(input: {
  projectId: string
  googleDocUrl: string
}): Promise<LinkSowResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = linkSowSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }

  const { projectId, googleDocUrl } = parsed.data

  // Check for existing active SOW
  const existing = await getActiveSowByProjectId(projectId)
  if (existing) {
    return { error: 'This project already has a linked SOW. Unlink it first.' }
  }

  // Extract document ID from URL
  const docId = extractDocIdFromUrl(googleDocUrl)
  if (!docId) {
    return { error: 'Invalid Google Docs URL. Please provide a valid document link.' }
  }

  // Verify document is accessible
  let docMeta
  try {
    docMeta = await getDocument(user.id, docId)
  } catch {
    return {
      error:
        'Unable to access the document. Make sure you have the Google OAuth integration connected and have access to this document.',
    }
  }

  // Insert the SOW record
  const sow = await insertSow({
    projectId,
    googleDocId: docId,
    googleDocUrl,
    googleDocTitle: docMeta.name ?? null,
    linkedBy: user.id,
  })

  // Create the first snapshot
  const { version } = await createSnapshot(sow.id, docId, user.id)

  return { data: { sowId: sow.id, snapshotVersion: version } }
}

// ---------------------------------------------------------------------------
// Link multiple Google Docs SOWs to a project (from Google Drive Picker)
// ---------------------------------------------------------------------------

const linkSowsSchema = z.object({
  projectId: z.string().uuid(),
  documents: z.array(
    z.object({
      googleDocId: z.string().min(1),
      googleDocTitle: z.string(),
      googleDocUrl: z.string().url(),
    })
  ),
})

type LinkSowsResult =
  | { data: { linked: number; skipped: number } }
  | { error: string }

export async function linkSows(input: {
  projectId: string
  documents: Array<{
    googleDocId: string
    googleDocTitle: string
    googleDocUrl: string
  }>
}): Promise<LinkSowsResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = linkSowsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }

  const { projectId, documents } = parsed.data

  // Get existing active SOWs to skip already-linked docs
  const existingSows = await getActiveSowsByProjectId(projectId)
  const existingDocIds = new Set(existingSows.map(s => s.googleDocId))

  let linked = 0
  let skipped = 0

  for (const doc of documents) {
    if (existingDocIds.has(doc.googleDocId)) {
      skipped++
      continue
    }

    // Verify document is accessible
    try {
      await getDocument(user.id, doc.googleDocId)
    } catch {
      // Skip inaccessible docs silently
      skipped++
      continue
    }

    const sow = await insertSow({
      projectId,
      googleDocId: doc.googleDocId,
      googleDocUrl: doc.googleDocUrl,
      googleDocTitle: doc.googleDocTitle,
      linkedBy: user.id,
    })

    await createSnapshot(sow.id, doc.googleDocId, user.id)
    linked++
  }

  return { data: { linked, skipped } }
}

// ---------------------------------------------------------------------------
// Unlink a specific SOW
// ---------------------------------------------------------------------------

const unlinkSowByIdSchema = z.object({
  sowId: z.string().uuid(),
})

type UnlinkSowResult = { ok: true } | { error: string }

export async function unlinkSow(input: {
  sowId: string
}): Promise<UnlinkSowResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = unlinkSowByIdSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }

  const sow = await getSowById(parsed.data.sowId)
  if (!sow || sow.deletedAt) {
    return { error: 'SOW not found.' }
  }

  await softDeleteSow(sow.id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Sync SOW (re-snapshot latest content)
// ---------------------------------------------------------------------------

const syncSowSchema = z.object({
  sowId: z.string().uuid(),
})

type SyncSowResult =
  | { data: { snapshotVersion: number; sectionCount: number } }
  | { error: string }

export async function syncSow(input: {
  sowId: string
}): Promise<SyncSowResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = syncSowSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }

  const sow = await getSowById(parsed.data.sowId)
  if (!sow || sow.deletedAt) {
    return { error: 'SOW not found.' }
  }

  try {
    const { version, sections } = await createSnapshot(
      sow.id,
      sow.googleDocId,
      user.id
    )

    return {
      data: { snapshotVersion: version, sectionCount: sections.length },
    }
  } catch {
    return { error: 'Failed to sync document. Check your Google OAuth connection.' }
  }
}

// ---------------------------------------------------------------------------
// Update SOW status
// ---------------------------------------------------------------------------

const updateSowStatusSchema = z.object({
  sowId: z.string().uuid(),
  status: z.enum(['DRAFT', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'FINISHED']),
})

type UpdateSowStatusResult = { ok: true } | { error: string }

export async function updateSowStatus(input: {
  sowId: string
  status: string
}): Promise<UpdateSowStatusResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = updateSowStatusSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input.' }

  const sow = await getSowById(parsed.data.sowId)
  if (!sow || sow.deletedAt) {
    return { error: 'SOW not found.' }
  }

  await updateSowStatusQuery(sow.id, parsed.data.status)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Fetch SOW data for display
// ---------------------------------------------------------------------------

export type SowDisplayData = {
  id: string
  googleDocId: string
  googleDocUrl: string
  googleDocTitle: string | null
  status: string
  linkedAt: string
  richContent: RichBlock[] | null
  currentSnapshot: {
    id: string
    version: number
    textContent: string | null
    docModifiedAt: string | null
    createdAt: string
  } | null
  sections: Array<{
    id: string
    headingLevel: number
    headingText: string
    bodyText: string | null
    sectionOrder: number
    firstSeenInVersion: number
  }>
}

export async function fetchSowForProject(input: {
  projectId: string
}): Promise<SowDisplayData | null> {
  await requireUser()

  const sow = await getActiveSowByProjectId(input.projectId)
  if (!sow) return null

  const snapshot = await getCurrentSnapshot(sow.id)
  const sections = snapshot
    ? await getSectionsForSnapshot(snapshot.id)
    : []

  // Parse rich content from rawContent for native rendering
  let richContent: RichBlock[] | null = null
  if (snapshot?.rawContent) {
    try {
      richContent = parseRichContent(
        snapshot.rawContent as unknown as GoogleDocsDocument
      )
    } catch {
      // Graceful degradation — fall back to section list
    }
  }

  return {
    id: sow.id,
    googleDocId: sow.googleDocId,
    googleDocUrl: sow.googleDocUrl,
    googleDocTitle: sow.googleDocTitle,
    status: sow.status,
    linkedAt: sow.createdAt,
    richContent,
    currentSnapshot: snapshot
      ? {
          id: snapshot.id,
          version: snapshot.version,
          textContent: snapshot.textContent,
          docModifiedAt: snapshot.docModifiedAt,
          createdAt: snapshot.createdAt,
        }
      : null,
    sections: sections.map(s => ({
      id: s.id,
      headingLevel: s.headingLevel,
      headingText: s.headingText,
      bodyText: s.bodyText,
      sectionOrder: s.sectionOrder,
      firstSeenInVersion: s.firstSeenInVersion,
    })),
  }
}

// ---------------------------------------------------------------------------
// Fetch all SOWs for a project (multi-SOW)
// ---------------------------------------------------------------------------

export async function fetchSowsForProject(input: {
  projectId: string
}): Promise<SowDisplayData[]> {
  await requireUser()

  const sows = await getActiveSowsByProjectId(input.projectId)
  if (sows.length === 0) return []

  const results: SowDisplayData[] = []

  for (const sow of sows) {
    const snapshot = await getCurrentSnapshot(sow.id)
    const sections = snapshot
      ? await getSectionsForSnapshot(snapshot.id)
      : []

    let richContent: RichBlock[] | null = null
    if (snapshot?.rawContent) {
      try {
        richContent = parseRichContent(
          snapshot.rawContent as unknown as GoogleDocsDocument
        )
      } catch {
        // Graceful degradation
      }
    }

    results.push({
      id: sow.id,
      googleDocId: sow.googleDocId,
      googleDocUrl: sow.googleDocUrl,
      googleDocTitle: sow.googleDocTitle,
      status: sow.status,
      linkedAt: sow.createdAt,
      richContent,
      currentSnapshot: snapshot
        ? {
            id: snapshot.id,
            version: snapshot.version,
            textContent: snapshot.textContent,
            docModifiedAt: snapshot.docModifiedAt,
            createdAt: snapshot.createdAt,
          }
        : null,
      sections: sections.map(s => ({
        id: s.id,
        headingLevel: s.headingLevel,
        headingText: s.headingText,
        bodyText: s.bodyText,
        sectionOrder: s.sectionOrder,
        firstSeenInVersion: s.firstSeenInVersion,
      })),
    })
  }

  return results
}
