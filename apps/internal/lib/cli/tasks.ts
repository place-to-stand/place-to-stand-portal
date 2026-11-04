import 'server-only'

import type { z } from 'zod'

import { and, eq, isNull, or } from 'drizzle-orm'

import { roleCan } from '@/lib/auth/capabilities'
import type { AppUser } from '@/lib/auth/session'
import { resolveProjectIdentifier } from '@/lib/data/projects'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { ensureProjectWorkAccess } from '@/lib/projects/access'
import {
  createTaskComment,
  listTaskComments,
} from '@/lib/queries/task-comments'
import { revalidateTaskViews } from '@/lib/tasks/revalidate-task-views'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'
import type { SaveTaskResult } from '@/lib/tasks/types'
import type { SelectTask } from '@/lib/queries/tasks/common'
import type { ActivitySourceValue } from '@/lib/types'

import { toRichTextHtml } from './description'
import { jsonOk } from './handler'
import {
  fetchAssigneeIdsByTask,
  fetchBoardLocationsByProject,
  listTasksForCli,
  loadTaskForEdit,
} from './queries/tasks'
import { resolveAssigneeIds, resolveUserIds } from './queries/users'
import type { cliCreateTaskSchema, cliUpdateTaskSchema } from './schemas/tasks'
import { serializeComment, type CliComment } from './serializers/comment'
import { serializeTask, type CliTask } from './serializers/task'
import { UUID_PATTERN } from '@pts/db/uuid'

export type CreateTaskInput = z.output<typeof cliCreateTaskSchema>
export type UpdateTaskInput = z.output<typeof cliUpdateTaskSchema>

/**
 * A write that landed. `warnings` lists follow-up steps that failed after
 * the save (page refresh, read-back): the task exists, so callers must not
 * retry the write.
 */
export type TaskWriteOutcome = {
  task: CliTask | { id: string }
  warnings?: string[]
}

/**
 * Accepts a project UUID or slug. Slugs are safe to resolve without client
 * scope: `projects.slug` carries a global unique index (packages/db schema,
 * `idx_projects_slug`). A project with no slug is reachable by id only.
 */
export async function resolveProjectId(
  user: AppUser,
  identifier: string
): Promise<string> {
  if (roleCan(user.role, 'projects.view_all')) {
    const project = await resolveProjectIdentifier(user, identifier)
    return project.resolvedId
  }

  // Sales: the board's guard, without the admin project detail.
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        UUID_PATTERN.test(identifier)
          ? or(eq(projects.id, identifier), eq(projects.slug, identifier))
          : eq(projects.slug, identifier)
      )
    )
    .limit(1)

  if (!project) {
    throw new NotFoundError('Project not found')
  }

  await ensureProjectWorkAccess(user, project.id)
  return project.id
}

export type TaskListRequest = {
  /** Project slug or UUID. */
  project?: string
  lead?: string
  status?: SelectTask['status']
  /** Assignee email or UUID. */
  assignee?: string
  /** Archived tasks instead of live ones. */
  archived?: boolean
  limit: number
}

/**
 * The one task list both the CLI and the MCP serve: resolve the refs, list,
 * hydrate assignees and board links, serialize. `hasMore` comes from asking
 * for one row past the limit.
 */
export async function listTasksForAgent(
  user: AppUser,
  { project, lead, status, assignee, archived, limit }: TaskListRequest
): Promise<{ items: CliTask[]; hasMore: boolean }> {
  const [projectId, assigneeIds] = await Promise.all([
    project ? resolveProjectId(user, project) : undefined,
    assignee ? resolveUserIds(user, [assignee]) : [],
  ])

  const rows = await listTasksForCli(user, {
    projectId,
    leadId: lead,
    status,
    assigneeId: assigneeIds[0],
    archived,
    limit: limit + 1,
  })
  const shown = rows.slice(0, limit)

  const [assignees, locations] = await Promise.all([
    fetchAssigneeIdsByTask(shown.map(row => row.id)),
    fetchBoardLocationsByProject(
      shown.flatMap(row => (row.projectId ? [row.projectId] : []))
    ),
  ])

  return {
    items: shown.map(row =>
      serializeTask(
        row,
        assignees.get(row.id) ?? [],
        (row.projectId && locations.get(row.projectId)) || null
      )
    ),
    hasMore: rows.length > limit,
  }
}

/** One task as the CLI sees it, board URL included. */
export async function loadSerializedTask(
  user: AppUser,
  taskId: string
): Promise<CliTask> {
  const { task, assigneeIds } = await loadTaskForEdit(user, taskId)
  const locations = task.projectId
    ? await fetchBoardLocationsByProject([task.projectId])
    : null

  return serializeTask(
    task,
    assigneeIds,
    (task.projectId && locations?.get(task.projectId)) || null
  )
}

/**
 * Create a task from the CLI / MCP payload. Shared by both channels so they
 * cannot drift; only `source` tells their activity rows apart.
 */
export async function createTaskFromInput(
  user: AppUser,
  payload: CreateTaskInput,
  source: ActivitySourceValue
): Promise<TaskWriteOutcome> {
  // Schema guarantees exactly one of the two: a task is on a project or a
  // lead.
  const projectId = payload.project
    ? await resolveProjectId(user, payload.project)
    : null
  const assigneeIds = await resolveAssigneeIds(user, payload.assigneeIds)

  const result = await saveTaskForActor(
    user,
    {
      projectId,
      title: payload.title,
      description: payload.description
        ? toRichTextHtml(payload.description)
        : null,
      status: payload.status,
      dueOn: payload.dueOn ?? null,
      assigneeIds,
      leadId: payload.leadId ?? null,
    },
    source
  )

  return finishTaskWrite(user, result)
}

/**
 * Partial update. The underlying save is a full replace, so anything the caller
 * omits is read back from the current row and sent unchanged — otherwise
 * `{title}` alone would blank the description and drop every assignee.
 *
 * An explicit `null` still clears a field; `undefined` (omitted) preserves it.
 */
export async function updateTaskFromInput(
  user: AppUser,
  taskId: string,
  payload: UpdateTaskInput,
  source: ActivitySourceValue
): Promise<TaskWriteOutcome> {
  const { task, assigneeIds } = await loadTaskForEdit(user, taskId)

  // Naming a project or a lead moves the task there and clears the other;
  // naming neither keeps it where it is.
  const projectId = payload.project
    ? await resolveProjectId(user, payload.project)
    : payload.leadId
      ? null
      : task.projectId

  const result = await saveTaskForActor(
    user,
    {
      id: task.id,
      projectId,
      title: payload.title ?? task.title,
      description:
        payload.description === undefined
          ? task.description
          : payload.description === null
            ? null
            : toRichTextHtml(payload.description),
      status: payload.status ?? task.status,
      dueOn: payload.dueOn === undefined ? task.dueOn : payload.dueOn,
      assigneeIds:
        payload.assigneeIds === undefined
          ? assigneeIds
          : await resolveAssigneeIds(user, payload.assigneeIds),
      leadId: payload.project
        ? null
        : payload.leadId === undefined
          ? task.leadId
          : payload.leadId,
    },
    source
  )

  return finishTaskWrite(user, result)
}

/**
 * A save is all or nothing (`SaveTaskResult`): an error means no row was
 * written, so the caller may fix the input and retry.
 */
async function finishTaskWrite(
  user: AppUser,
  result: SaveTaskResult
): Promise<TaskWriteOutcome> {
  if (result.error !== undefined) {
    // `saveTaskForActor` returns prose for these, and they are all
    // caller-fixable (bad project, missing task, invalid payload).
    if (result.error === 'Task not found.') {
      throw new NotFoundError(result.error)
    }

    throw new BadRequestError(result.error)
  }

  // The task is saved. From here a failure must not read as a failed save,
  // or the caller retries and makes a duplicate.
  const warnings: string[] = []

  try {
    revalidateTaskViews()
  } catch (error) {
    console.error('Task saved, but refreshing task pages failed', error)
    warnings.push('Saved, but portal pages may show the old task until reload.')
  }

  try {
    const task = await loadSerializedTask(user, result.taskId)
    return warnings.length ? { task, warnings } : { task }
  } catch (error) {
    console.error('Task saved, but reading it back failed', error)
    warnings.push('Saved, but the task could not be read back. Use get_task.')
    return { task: { id: result.taskId }, warnings }
  }
}

/** A task write as the CLI's HTTP response. */
export function respondToTaskWrite(outcome: TaskWriteOutcome, status: number) {
  return jsonOk(outcome.task, {
    status,
    warning: outcome.warnings?.join(' '),
  })
}

/**
 * Post a comment as `user`. Comments render through `sanitizeEditorHtml`,
 * same as descriptions, so plain text needs the same conversion to survive
 * with its structure. `createTaskComment` writes the activity row itself.
 */
export async function addTaskComment(
  user: AppUser,
  taskId: string,
  body: string,
  source: ActivitySourceValue
): Promise<CliComment | { id: string; taskId: string }> {
  const { commentId } = await createTaskComment(
    user,
    { taskId, body: toRichTextHtml(body) },
    { source }
  )

  const page = await listTaskComments(user, taskId, { limit: 1 })
  const created = page.items.find(item => item.id === commentId)

  return created ? serializeComment(created) : { id: commentId, taskId }
}
