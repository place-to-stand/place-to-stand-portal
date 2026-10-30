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

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Makes the project's live members exactly `memberIds`, inside the caller's
 * transaction. Only non-admin staff can be members (admins already see every
 * project): check the list with `assertValidProjectMemberIds` before opening
 * the transaction. Returns what changed so the caller can log it after
 * commit (`logProjectMembersChanged`).
 */
export async function writeProjectMembers(
  tx: DbTransaction,
  args: { actorId: string; projectId: string; memberIds: readonly string[] }
): Promise<{ added: string[]; removed: string[] }> {
  const { actorId, projectId } = args
  const desired = Array.from(new Set(args.memberIds))

  const currentRows = await tx
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        isNull(projectMembers.deletedAt)
      )
    )
  const current = currentRows.map(row => row.userId)
  const added = desired.filter(id => !current.includes(id))
  const removed = current.filter(id => !desired.includes(id))

  const now = new Date().toISOString()

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
          createdBy: actorId,
          deletedAt: null,
        }))
      )
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { deletedAt: null, createdBy: actorId, createdAt: now },
      })
  }

  return { added, removed }
}

/** Logs one PROJECT_UPDATED row for a member change; no-op when none. */
export async function logProjectMembersChanged(args: {
  actor: Pick<AppUser, 'id' | 'role'>
  projectId: string
  added: string[]
  removed: string[]
}): Promise<void> {
  const { actor, projectId, added, removed } = args
  if (!added.length && !removed.length) return

  const [project] = await db
    .select({ name: projects.name, companyId: projects.companyId })
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
    targetCompanyId: project?.companyId ?? null,
    metadata: event.metadata,
  })
}
