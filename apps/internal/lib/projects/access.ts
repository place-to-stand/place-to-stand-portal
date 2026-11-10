import { personNameSql } from '@pts/db/names'
import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leads, projectMembers, projects, tasks, users } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { roleCan } from '@/lib/auth/capabilities'

/**
 * Who may see and work a project's tasks.
 *
 * - ADMIN: every project.
 * - Everyone else on staff (SALES): only projects they were added to
 *   (`project_members`) and their own PERSONAL boards. Only the task board: time logs,
 *   review, billing, GitHub and planning stay admin-only and keep
 *   using `ensureProjectAccess` / `ensureTaskAccess`, which still assert ADMIN.
 *
 * A task belongs to a project or to a lead, never both. Lead tasks have no
 * project: anyone with `leads.tasks` works them, on every live lead.
 *
 * Every helper here is the task-board twin of an admin guard. Use these only
 * on the paths opened to project members; anything else stays admin-only by
 * default.
 */

export function isProjectStaff(user: AppUser | null | undefined): boolean {
  return !!user && roleCan(user.role, 'projects.view_member')
}

/**
 * Ids of the live projects a non-admin may work, or `null` for "all" (admins).
 * Cached per request.
 */
export const listWorkableProjectIds = cache(
  async (user: AppUser): Promise<string[] | null> => {
    if (roleCan(user.role, 'projects.view_all')) return null
    if (!isProjectStaff(user)) return []

    const rows = await db
      .selectDistinct({ id: projects.id })
      .from(projects)
      .leftJoin(
        projectMembers,
        and(
          eq(projectMembers.projectId, projects.id),
          eq(projectMembers.userId, user.id),
          isNull(projectMembers.deletedAt)
        )
      )
      .where(
        and(
          isNull(projects.deletedAt),
          or(
            eq(projectMembers.userId, user.id),
            and(eq(projects.type, 'PERSONAL'), eq(projects.createdBy, user.id))
          )
        )
      )

    return rows.map(row => row.id)
  }
)

/**
 * Whether a task in `home` is one the user may work, given their
 * `listWorkableProjectIds` (null = every project).
 */
export function isWorkableTaskHome(
  user: AppUser,
  workableProjectIds: readonly string[] | null,
  home: { projectId: string | null; leadId: string | null }
): boolean {
  if (home.projectId) {
    return (
      workableProjectIds === null || workableProjectIds.includes(home.projectId)
    )
  }
  return !!home.leadId && roleCan(user.role, 'leads.tasks')
}

/**
 * SQL twin of `isWorkableTaskHome` for task queries: tasks on the user's
 * workable projects, plus lead tasks when they may work those. `undefined`
 * means no filter (admins).
 */
export function workableTasksFilter(
  user: AppUser,
  workableProjectIds: readonly string[] | null
): SQL | undefined {
  if (workableProjectIds === null) return undefined

  const parts: SQL[] = []
  if (workableProjectIds.length) {
    parts.push(inArray(tasks.projectId, [...workableProjectIds]))
  }
  if (roleCan(user.role, 'leads.tasks')) {
    parts.push(isNull(tasks.projectId))
  }

  return parts.length ? or(...parts) : sql`false`
}

/**
 * Task-board guard for a project: NotFound when it is missing or archived,
 * Forbidden when the user is not staff or (SALES) not a member.
 */
export async function ensureProjectWorkAccess(
  user: AppUser,
  projectId: string
): Promise<void> {
  if (!isProjectStaff(user)) {
    throw new ForbiddenError('Project access required')
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1)

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  if (roleCan(user.role, 'projects.view_all')) return

  const ids = await listWorkableProjectIds(user)
  if (ids !== null && !ids.includes(projectId)) {
    throw new ForbiddenError('You are not a member of this project')
  }
}

/**
 * Guard for a lead's tasks: NotFound when the lead is missing or archived,
 * Forbidden without `leads.tasks`.
 */
export async function ensureLeadTaskAccess(
  user: AppUser,
  leadId: string
): Promise<void> {
  if (!roleCan(user.role, 'leads.tasks')) {
    throw new ForbiddenError('You don’t have permission to work lead tasks.')
  }

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) {
    throw new NotFoundError('Lead not found')
  }
}

/** Guard for where a task lives: its project or its lead. */
export async function ensureTaskHomeAccess(
  user: AppUser,
  home: { projectId: string | null; leadId: string | null }
): Promise<void> {
  if (home.projectId) {
    await ensureProjectWorkAccess(user, home.projectId)
  } else if (home.leadId) {
    await ensureLeadTaskAccess(user, home.leadId)
  } else {
    throw new NotFoundError('Task not found')
  }
}

/**
 * Task-board guard for one task, via its project or its lead. Returns the
 * project id (null for a lead task).
 */
export async function ensureTaskWorkAccess(
  user: AppUser,
  taskId: string,
  options: { includeArchived?: boolean } = {}
): Promise<string | null> {
  const { includeArchived = false } = options

  const [task] = await db
    .select({ id: tasks.id, projectId: tasks.projectId, leadId: tasks.leadId })
    .from(tasks)
    .where(
      includeArchived
        ? eq(tasks.id, taskId)
        : and(eq(tasks.id, taskId), isNull(tasks.deletedAt))
    )
    .limit(1)

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  await ensureTaskHomeAccess(user, task)
  return task.projectId
}

/** Non-throwing form of `ensureTaskWorkAccess`. */
export async function canWorkTask(
  user: AppUser,
  taskId: string
): Promise<boolean> {
  try {
    await ensureTaskWorkAccess(user, taskId)
    return true
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      return false
    }
    throw error
  }
}

/**
 * Task assignees must be able to open the task: admins always, other staff
 * only on projects they can work, and anyone with `leads.tasks` on a lead
 * task (`projectId` null). Returns the names of anyone who can't, so the
 * caller can say who to add to the project first.
 */
export async function findAssigneesWithoutAccess(
  projectId: string | null,
  assigneeIds: readonly string[]
): Promise<string[]> {
  const blocked = await findBlockedAssignees(projectId, assigneeIds)
  return blocked.map(person => person.name)
}

/** `findAssigneesWithoutAccess`, keeping each blocked person's id. */
export async function findBlockedAssignees(
  projectId: string | null,
  assigneeIds: readonly string[]
): Promise<{ id: string; name: string }[]> {
  if (!assigneeIds.length) return []

  if (projectId === null) {
    const rows = await db
      .select({
        id: users.id,
        role: users.role,
        fullName: personNameSql,
        email: users.email,
        deletedAt: users.deletedAt,
        disabledAt: users.disabledAt,
      })
      .from(users)
      .where(inArray(users.id, [...assigneeIds]))

    return assigneeIds.flatMap(id => {
      const row = rows.find(item => item.id === id)
      if (!row) return [{ id, name: 'Unknown user' }]
      const active = !row.deletedAt && !row.disabledAt
      return active && roleCan(row.role, 'leads.tasks')
        ? []
        : [{ id, name: row.fullName?.trim() || row.email }]
    })
  }

  const [project] = await db
    .select({
      type: projects.type,
      createdBy: projects.createdBy,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      fullName: personNameSql,
      email: users.email,
      memberId: projectMembers.id,
      deletedAt: users.deletedAt,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .leftJoin(
      projectMembers,
      and(
        eq(projectMembers.userId, users.id),
        eq(projectMembers.projectId, projectId),
        isNull(projectMembers.deletedAt)
      )
    )
    .where(inArray(users.id, [...assigneeIds]))

  const blocked: { id: string; name: string }[] = []

  for (const id of assigneeIds) {
    const row = rows.find(item => item.id === id)
    if (!row) {
      blocked.push({ id, name: 'Unknown user' })
      continue
    }
    const active = !row.deletedAt && !row.disabledAt
    if (active && row.role === 'ADMIN') continue

    const ownsPersonalBoard =
      project?.type === 'PERSONAL' && project.createdBy === row.id
    if (active && row.role === 'SALES' && (row.memberId || ownsPersonalBoard)) {
      continue
    }

    blocked.push({ id, name: row.fullName?.trim() || row.email })
  }

  return blocked
}
