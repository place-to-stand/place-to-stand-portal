import { and, eq, inArray, isNull } from 'drizzle-orm'

import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projectIntegrationLinks } from '@/lib/db/schema'
import {
  INTEGRATION_PROVIDERS,
  type ExternalProjectOption,
  type ProjectIntegrationLink,
} from '@/lib/types/integrations'

/** The signed-in user performing the link/unlink; the role is never assumed. */
export type IntegrationLinkActor = Pick<AppUser, 'id' | 'role'>

export async function getProjectIntegrationLinks(
  projectId: string
): Promise<ProjectIntegrationLink[]> {
  return db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.projectId, projectId),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .orderBy(projectIntegrationLinks.provider, projectIntegrationLinks.createdAt)
}

/** Batch fetch for list pages — one query for every project on screen. */
export async function getIntegrationLinksForProjects(
  projectIds: string[]
): Promise<Map<string, ProjectIntegrationLink[]>> {
  if (projectIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        inArray(projectIntegrationLinks.projectId, projectIds),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .orderBy(projectIntegrationLinks.provider, projectIntegrationLinks.createdAt)

  const linksByProject = new Map<string, ProjectIntegrationLink[]>()
  rows.forEach(row => {
    const existing = linksByProject.get(row.projectId) ?? []
    existing.push(row)
    linksByProject.set(row.projectId, existing)
  })

  return linksByProject
}

export async function getIntegrationLinkById(
  linkId: string
): Promise<ProjectIntegrationLink | null> {
  const [link] = await db
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.id, linkId),
        isNull(projectIntegrationLinks.deletedAt)
      )
    )
    .limit(1)

  return link ?? null
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** `db` or an open transaction, so a sheet save can write links in its own. */
export type IntegrationLinkExecutor = typeof db | DbTransaction

/**
 * Writes a link row for an external project. A previously unlinked row for
 * the same external project is restored (and refreshed) rather than
 * duplicated, so the unique constraint on (project, provider, external id)
 * never trips. Returns `created: false` when it was already linked.
 */
export async function writeIntegrationLink(
  executor: IntegrationLinkExecutor,
  projectId: string,
  option: ExternalProjectOption,
  actorId: string
): Promise<{ link: ProjectIntegrationLink; created: boolean }> {
  const now = new Date().toISOString()
  const details = {
    externalName: option.externalName,
    ownerId: option.ownerId,
    ownerSlug: option.ownerSlug,
    ownerName: option.ownerName,
    url: option.url,
    metadata: option.metadata,
  }

  const [existing] = await executor
    .select()
    .from(projectIntegrationLinks)
    .where(
      and(
        eq(projectIntegrationLinks.projectId, projectId),
        eq(projectIntegrationLinks.provider, option.provider),
        eq(projectIntegrationLinks.externalId, option.externalId)
      )
    )
    .limit(1)

  if (existing && !existing.deletedAt) {
    return { link: existing, created: false }
  }

  if (existing) {
    const [restored] = await executor
      .update(projectIntegrationLinks)
      .set({ ...details, linkedBy: actorId, updatedAt: now, deletedAt: null })
      .where(eq(projectIntegrationLinks.id, existing.id))
      .returning()
    return { link: restored, created: true }
  }

  const [inserted] = await executor
    .insert(projectIntegrationLinks)
    .values({
      projectId,
      provider: option.provider,
      externalId: option.externalId,
      ...details,
      linkedBy: actorId,
    })
    .returning()
  return { link: inserted, created: true }
}

/** Archives a link row (soft delete). */
export async function archiveIntegrationLink(
  executor: IntegrationLinkExecutor,
  linkId: string
): Promise<void> {
  const now = new Date().toISOString()
  await executor
    .update(projectIntegrationLinks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(projectIntegrationLinks.id, linkId))
}

export async function logIntegrationLinked(
  actor: IntegrationLinkActor,
  projectId: string,
  option: Pick<
    ExternalProjectOption,
    'provider' | 'externalId' | 'externalName' | 'ownerName'
  >
): Promise<void> {
  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    verb: 'INTEGRATION_PROJECT_LINKED',
    summary: `Linked ${INTEGRATION_PROVIDERS[option.provider].label} project ${option.externalName}`,
    targetType: 'PROJECT',
    targetId: projectId,
    targetProjectId: projectId,
    metadata: {
      provider: option.provider,
      externalId: option.externalId,
      externalName: option.externalName,
      ownerName: option.ownerName,
    },
  })
}

export async function logIntegrationUnlinked(
  actor: IntegrationLinkActor,
  link: ProjectIntegrationLink
): Promise<void> {
  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    verb: 'INTEGRATION_PROJECT_UNLINKED',
    summary: `Unlinked ${INTEGRATION_PROVIDERS[link.provider].label} project ${link.externalName}`,
    targetType: 'PROJECT',
    targetId: link.projectId,
    targetProjectId: link.projectId,
    metadata: {
      provider: link.provider,
      externalId: link.externalId,
      externalName: link.externalName,
    },
  })
}

/** Links an external project now (REST route); see `writeIntegrationLink`. */
export async function linkExternalProject(
  projectId: string,
  option: ExternalProjectOption,
  actor: IntegrationLinkActor
): Promise<ProjectIntegrationLink> {
  const { link, created } = await writeIntegrationLink(
    db,
    projectId,
    option,
    actor.id
  )
  if (created) {
    await logIntegrationLinked(actor, projectId, option)
  }
  return link
}

export async function unlinkExternalProject(
  link: ProjectIntegrationLink,
  actor: IntegrationLinkActor
): Promise<void> {
  await archiveIntegrationLink(db, link.id)
  await logIntegrationUnlinked(actor, link)
}
