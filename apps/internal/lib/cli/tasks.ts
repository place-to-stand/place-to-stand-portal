import 'server-only'

import type { z } from 'zod'

import { revalidateProjectTaskViews } from '@/app/(dashboard)/projects/actions/shared'
import type { AppUser } from '@/lib/auth/session'
import { resolveProjectIdentifier } from '@/lib/data/projects'
import { BadRequestError, NotFoundError } from '@/lib/errors/http'
import { getOrCreateSalesProject } from '@/lib/leads/sales-project'
import { createTaskComment, listTaskComments } from '@/lib/queries/task-comments'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'
import type { SaveTaskResult } from '@/lib/tasks/types'
import type { ActivitySourceValue } from '@/lib/types'

import { toRichTextHtml } from './description'
import { jsonOk } from './handler'
import { fetchBoardLocationsByProject, loadTaskForEdit } from './queries/tasks'
import { resolveAssigneeIds } from './queries/users'
import type { cliCreateTaskSchema, cliUpdateTaskSchema } from './schemas/tasks'
import { serializeComment, type CliComment } from './serializers/comment'
import { serializeTask, type CliTask } from './serializers/task'

export type CreateTaskInput = z.output<typeof cliCreateTaskSchema>
export type UpdateTaskInput = z.output<typeof cliUpdateTaskSchema>

/** A write that landed, in full. */
export type TaskWriteOutcome = {
  task: CliTask
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
  const project = await resolveProjectIdentifier(user, identifier)

  return project.resolvedId
}

/** One task as the CLI sees it, board URL included. */
export async function loadSerializedTask(
  user: AppUser,
  taskId: string
): Promise<CliTask> {
  const { task, assigneeIds } = await loadTaskForEdit(user, taskId)
  const locations = await fetchBoardLocationsByProject([task.projectId])

  return serializeTask(
    task,
    assigneeIds,
    locations.get(task.projectId) ?? null
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
  // Schema guarantees one of the two; a lead task with no explicit project
  // goes where the lead sheet would put it.
  const projectId = payload.project
    ? await resolveProjectId(user, payload.project)
    : await getOrCreateSalesProject(user.id)
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

  const projectId = payload.project
    ? await resolveProjectId(user, payload.project)
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
      leadId: payload.leadId === undefined ? task.leadId : payload.leadId,
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

  await revalidateProjectTaskViews()

  return { task: await loadSerializedTask(user, result.taskId) }
}

/** A task write as the CLI's HTTP response. */
export function respondToTaskWrite(outcome: TaskWriteOutcome, status: number) {
  return jsonOk(outcome.task, { status })
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
