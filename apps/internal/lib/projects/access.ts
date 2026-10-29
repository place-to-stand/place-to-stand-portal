import 'server-only'

import { cache } from 'react'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { projectMembers, projects, tasks, users } from '@/lib/db/schema'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

/**
 * Who may see and work a project's tasks.
 *
 * - ADMIN: every project.
 * - Everyone else on staff (SALES): only projects they were added to
 *   (`project_members`) and their own PERSONAL boards. No project is special:
 *   lead tasks live in the internal Sales project, so a sales user needs to be
 *   a member of it like any other. Only the task board: time logs,
 *   review, overview, billing, GitHub and planning stay admin-only and keep
 *   using `ensureProjectAccess` / `ensureTaskAccess`, which still assert ADMIN.
 *
 * Every helper here is the task-board twin of an admin guard. Use these only
 * on the paths opened to project members; anything else stays admin-only by
 * default.
 */

export function isProjectStaff(user: AppUser | null | undefined): boolean {
  return !!user && (user.role === 'ADMIN' || user.role === 'SALES')
}

/**
 * Ids of the live projects a non-admin may work, or `null` for "all" (admins).
 * Cached per request.
 */
export const listWorkableProjectIds = cache(
  async (user: AppUser): Promise<string[] | null> => {
    if (user.role === 'ADMIN') return null
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

  if (user.role === 'ADMIN') return

  const ids = await listWorkableProjectIds(user)
  if (ids !== null && !ids.includes(projectId)) {
    throw new ForbiddenError('You are not a member of this project')
  }
}

/** Task-board guard for one task, via its project. Returns the project id. */
export async function ensureTaskWorkAccess(
  user: AppUser,
  taskId: string,
  options: { includeArchived?: boolean } = {}
): Promise<string> {
  const { includeArchived = false } = options

  const [task] = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
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

  await ensureProjectWorkAccess(user, task.projectId)
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
 * only on projects they can work. Returns the names of anyone who can't, so
 * the caller can say who to add to the project first.
 */
export async function findAssigneesWithoutAccess(
  projectId: string,
  assigneeIds: readonly string[]
): Promise<string[]> {
  if (!assigneeIds.length) return []

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
      fullName: users.fullName,
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

  const blocked: string[] = []

  for (const id of assigneeIds) {
    const row = rows.find(item => item.id === id)
    if (!row) {
      blocked.push('Unknown user')
      continue
    }
    const active = !row.deletedAt && !row.disabledAt
    if (active && row.role === 'ADMIN') continue

    const ownsPersonalBoard =
      project?.type === 'PERSONAL' && project.createdBy === row.id
    if (active && row.role === 'SALES' && (row.memberId || ownsPersonalBoard)) {
      continue
    }

    blocked.push(row.fullName?.trim() || row.email)
  }

  return blocked
}
