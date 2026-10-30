import { personAvatarSql, personNameSql } from '@pts/db/names'
import 'server-only'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { projectUpdatedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projectMembers, projects, users } from '@/lib/db/schema'

/** A staff user who can be added to a project (non-admin staff). */
export type ProjectMemberCandidate = {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  disabled: boolean
}

/** Roles that need membership to see a project. Admins see everything. */
const MEMBER_ROLES = ['SALES'] as const

export async function listProjectMemberIds(
  projectId: string
): Promise<string[]> {
  const rows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        isNull(projectMembers.deletedAt)
      )
    )

  return rows.map(row => row.userId)
}

export async function listProjectMemberCandidates(): Promise<
  ProjectMemberCandidate[]
> {
  const rows = await db
    .select({
      id: users.id,
      fullName: personNameSql,
      email: users.email,
      avatarUrl: personAvatarSql,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(and(inArray(users.role, [...MEMBER_ROLES]), isNull(users.deletedAt)))
    .orderBy(asc(personNameSql), asc(users.email))

  return rows.map(row => ({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    avatarUrl: row.avatarUrl,
    disabled: Boolean(row.disabledAt),
  }))
}

export class InvalidProjectMemberError extends Error {}

/** Throws `InvalidProjectMemberError` unless every id is a live sales user. */
export async function assertValidProjectMemberIds(
  memberIds: readonly string[]
): Promise<void> {
  const desired = Array.from(new Set(memberIds))
  if (!desired.length) return

  const valid = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, desired),
        inArray(users.role, [...MEMBER_ROLES]),
        isNull(users.deletedAt)
      )
    )

  if (valid.length !== desired.length) {
    throw new InvalidProjectMemberError(
      'Only sales users can be added as project members.'
    )
  }
}

/**
 * Makes the project's live members exactly `memberIds`. Only non-admin staff
 * can be members (admins already see every project); anything else is
 * rejected before a row changes. Logs one PROJECT_UPDATED row when the set
 * changed.
 */
export async function syncProjectMembers(args: {
  actor: AppUser
  projectId: string
  memberIds: readonly string[]
}): Promise<{ added: string[]; removed: string[] }> {
  const { actor, projectId } = args
  const desired = Array.from(new Set(args.memberIds))

  await assertValidProjectMemberIds(desired)

  const current = await listProjectMemberIds(projectId)
  const added = desired.filter(id => !current.includes(id))
  const removed = current.filter(id => !desired.includes(id))

  if (!added.length && !removed.length) {
    return { added, removed }
  }

  const now = new Date().toISOString()

  await db.transaction(async tx => {
    if (removed.length) {
      await tx
        .update(projectMembers)
        .set({ deletedAt: now })
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            inArray(projectMembers.userId, removed),
            isNull(projectMembers.deletedAt)
          )
        )
    }

    if (added.length) {
      await tx
        .insert(projectMembers)
        .values(
          added.map(userId => ({
            projectId,
            userId,
            createdBy: actor.id,
            deletedAt: null,
          }))
        )
        .onConflictDoUpdate({
          target: [projectMembers.projectId, projectMembers.userId],
          set: { deletedAt: null, createdBy: actor.id, createdAt: now },
        })
    }
  })

  const [project] = await db
    .select({ name: projects.name, clientId: projects.companyId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  const event = projectUpdatedEvent({
    name: project?.name ?? 'project',
    changedFields: ['members'],
    details: { addedMemberIds: added, removedMemberIds: removed },
  })

  await logActivity({
    actorId: actor.id,
    actorRole: actor.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROJECT',
    targetId: projectId,
    targetProjectId: projectId,
    targetCompanyId: project?.clientId ?? null,
    metadata: event.metadata,
  })

  return { added, removed }
}
