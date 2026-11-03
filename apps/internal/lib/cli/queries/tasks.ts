import 'server-only'

import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  sql,
  isNotNull,
} from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, projects, taskAssignees, tasks } from '@/lib/db/schema'
import { PROJECT_SPECIAL_SEGMENTS } from '@/lib/projects/board/board-utils'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureTaskWorkAccess,
  isProjectStaff,
  listWorkableProjectIds,
} from '@/lib/projects/access'
import { taskFields, type SelectTask } from '@/lib/queries/tasks/common'

export type CliTaskFilters = {
  projectId?: string
  leadId?: string
  status?: SelectTask['status']
  assigneeId?: string
  /** Archived tasks instead of live ones. */
  archived?: boolean
  limit: number
}

/**
 * Assignees for a batch of tasks, as taskId -> userIds. Batched deliberately:
 * a list of 50 tasks should cost one extra query, not 50.
 */
export async function fetchAssigneeIdsByTask(
  taskIds: string[]
): Promise<Map<string, string[]>> {
  const grouped = new Map<string, string[]>()

  if (!taskIds.length) {
    return grouped
  }

  const rows = await db
    .select({
      taskId: taskAssignees.taskId,
      userId: taskAssignees.userId,
    })
    .from(taskAssignees)
    .where(
      and(
        inArray(taskAssignees.taskId, taskIds),
        isNull(taskAssignees.deletedAt)
      )
    )

  for (const row of rows) {
    const existing = grouped.get(row.taskId)

    if (existing) {
      existing.push(row.userId)
    } else {
      grouped.set(row.taskId, [row.userId])
    }
  }

  return grouped
}

/** The slugs a task's board URL is built from. */
export type BoardLocation = {
  clientSegment: string
  projectSlug: string
}

/**
 * Where each project's board lives, as projectId -> location, or null when the
 * board itself can't link the project (no project slug, or a client project
 * whose client has no slug). Batched like `fetchAssigneeIdsByTask`: a list of
 * tasks costs one extra query however many projects it spans.
 */
export async function fetchBoardLocationsByProject(
  projectIds: string[]
): Promise<Map<string, BoardLocation | null>> {
  const located = new Map<string, BoardLocation | null>()
  const uniqueIds = [...new Set(projectIds)]

  if (!uniqueIds.length) {
    return located
  }

  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      type: projects.type,
      clientSlug: companies.slug,
    })
    .from(projects)
    .leftJoin(companies, eq(companies.id, projects.companyId))
    .where(inArray(projects.id, uniqueIds))

  for (const row of rows) {
    // Mirrors `getProjectClientSegment`, which wants a hydrated project.
    const clientSegment =
      row.type === 'INTERNAL'
        ? PROJECT_SPECIAL_SEGMENTS.INTERNAL
        : row.type === 'PERSONAL'
          ? PROJECT_SPECIAL_SEGMENTS.PERSONAL
          : row.clientSlug

    located.set(
      row.id,
      row.slug && clientSegment
        ? { clientSegment, projectSlug: row.slug }
        : null
    )
  }

  return located
}

/**
 * Ordered by most recently updated rather than board rank — a CLI listing
 * answers "what changed lately", and rank only means something within a single
 * project column.
 */
export async function listTasksForCli(
  user: AppUser,
  { projectId, leadId, status, assigneeId, archived, limit }: CliTaskFilters
): Promise<SelectTask[]> {
  if (!isProjectStaff(user)) {
    throw new ForbiddenError('Project access required')
  }

  // Admins see every project; Sales only the projects they can work (the
  // same set as the board and My Tasks).
  const workable = await listWorkableProjectIds(user)
  if (workable && !workable.length) {
    return []
  }

  const conditions = [
    archived ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
  ]

  if (workable) {
    conditions.push(inArray(tasks.projectId, workable))
  }

  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId))
  }

  if (leadId) {
    conditions.push(eq(tasks.leadId, leadId))
  }

  if (status) {
    conditions.push(eq(tasks.status, status))
  }

  if (assigneeId) {
    // EXISTS rather than a join: keeps one row per task without a DISTINCT,
    // and leaves the select shape untouched.
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(taskAssignees)
          .where(
            and(
              eq(taskAssignees.taskId, tasks.id),
              eq(taskAssignees.userId, assigneeId),
              isNull(taskAssignees.deletedAt)
            )
          )
      )
    )
  }

  return db
    .select(taskFields)
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
}

export type TaskEditSnapshot = {
  task: SelectTask
  assigneeIds: string[]
}

/**
 * Current state of a task, for merging a partial update on top of. The
 * board's guard: admins reach any task, Sales only tasks on projects they
 * can work.
 */
export async function loadTaskForEdit(
  user: AppUser,
  taskId: string
): Promise<TaskEditSnapshot> {
  await ensureTaskWorkAccess(user, taskId)

  const [[task], assignees] = await Promise.all([
    db
      .select(taskFields)
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .limit(1),
    fetchAssigneeIdsByTask([taskId]),
  ])

  if (!task) {
    throw new NotFoundError('Task not found')
  }

  return { task, assigneeIds: assignees.get(taskId) ?? [] }
}
