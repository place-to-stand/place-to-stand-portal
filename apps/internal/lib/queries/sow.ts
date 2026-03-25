import { eq, and, asc, desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  projectSows,
  sowSnapshots,
  sowSections,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Project SOWs
// ---------------------------------------------------------------------------

export async function getActiveSowByProjectId(projectId: string) {
  const [sow] = await db
    .select()
    .from(projectSows)
    .where(
      and(
        eq(projectSows.projectId, projectId),
        isNull(projectSows.deletedAt)
      )
    )
    .limit(1)

  return sow ?? null
}

export async function getActiveSowsByProjectId(projectId: string) {
  return db
    .select()
    .from(projectSows)
    .where(
      and(
        eq(projectSows.projectId, projectId),
        isNull(projectSows.deletedAt)
      )
    )
    .orderBy(desc(projectSows.createdAt))
}

export async function getSowById(sowId: string) {
  const [sow] = await db
    .select()
    .from(projectSows)
    .where(eq(projectSows.id, sowId))
    .limit(1)

  return sow ?? null
}

export async function insertSow(values: {
  projectId: string
  googleDocId: string
  googleDocUrl: string
  googleDocTitle: string | null
  linkedBy: string
}) {
  const [sow] = await db
    .insert(projectSows)
    .values(values)
    .returning()

  return sow
}

export async function softDeleteSow(sowId: string) {
  await db
    .update(projectSows)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(projectSows.id, sowId))
}

export async function updateSowStatus(
  sowId: string,
  status: 'DRAFT' | 'ACCEPTED' | 'IN_PROGRESS' | 'BLOCKED' | 'FINISHED'
) {
  await db
    .update(projectSows)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(projectSows.id, sowId))
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export async function getLatestSnapshot(sowId: string) {
  const [snapshot] = await db
    .select()
    .from(sowSnapshots)
    .where(eq(sowSnapshots.sowId, sowId))
    .orderBy(desc(sowSnapshots.version))
    .limit(1)

  return snapshot ?? null
}

export async function getSnapshotById(snapshotId: string) {
  const [snapshot] = await db
    .select()
    .from(sowSnapshots)
    .where(eq(sowSnapshots.id, snapshotId))
    .limit(1)

  return snapshot ?? null
}

export async function getCurrentSnapshot(sowId: string) {
  const [snapshot] = await db
    .select()
    .from(sowSnapshots)
    .where(
      and(
        eq(sowSnapshots.sowId, sowId),
        eq(sowSnapshots.status, 'CURRENT')
      )
    )
    .limit(1)

  return snapshot ?? null
}

export async function insertSnapshot(values: {
  sowId: string
  version: number
  status: 'CURRENT' | 'SUPERSEDED'
  rawContent: Record<string, unknown> | null
  textContent: string | null
  docModifiedAt: string | null
  snappedBy: string
}) {
  const [snapshot] = await db
    .insert(sowSnapshots)
    .values(values)
    .returning()

  return snapshot
}

export async function supersedePreviousSnapshots(sowId: string) {
  await db
    .update(sowSnapshots)
    .set({ status: 'SUPERSEDED' })
    .where(
      and(
        eq(sowSnapshots.sowId, sowId),
        eq(sowSnapshots.status, 'CURRENT')
      )
    )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function getSectionsForSnapshot(snapshotId: string) {
  return db
    .select()
    .from(sowSections)
    .where(eq(sowSections.snapshotId, snapshotId))
    .orderBy(asc(sowSections.sectionOrder))
}

export async function getSectionsForSow(sowId: string) {
  return db
    .select()
    .from(sowSections)
    .where(eq(sowSections.sowId, sowId))
    .orderBy(asc(sowSections.sectionOrder))
}

export async function insertSections(
  values: Array<{
    snapshotId: string
    sowId: string
    headingLevel: number
    headingText: string
    bodyText: string | null
    sectionOrder: number
    contentHash: string
    firstSeenInVersion: number
  }>
) {
  await db.insert(sowSections).values(values)
}
