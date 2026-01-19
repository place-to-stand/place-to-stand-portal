'use server'

/**
 * Convex task data operations
 *
 * This module provides server-side wrappers for Convex task queries/mutations.
 * Used when CONVEX_FLAGS.TASKS is enabled.
 *
 * Type mappings convert Convex documents to the existing Supabase-based types
 * for backward compatibility during migration.
 */

import { fetchQuery, fetchMutation } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'

import { api } from '@/convex/_generated/api'
import type { Doc } from '@/convex/_generated/dataModel'
import type {
  DbTask,
  TaskWithRelations,
  TaskStatusValue,
  DbTaskAttachment,
  TaskCommentWithAuthor,
} from '@/lib/types'
import type { RawTaskWithRelations } from '@/lib/data/projects/types'

// ============================================================
// TYPE MAPPINGS
// ============================================================

/**
 * Maps a Convex task document to the existing DbTask type
 *
 * Uses supabaseId as ID for PostgreSQL compatibility during migration.
 * Falls back to Convex _id for records created after migration.
 */
function mapConvexTaskToDbTask(task: Doc<'tasks'>): DbTask {
  return {
    id: task.supabaseId ?? task._id,
    project_id: task.projectId as unknown as string, // Will be resolved by caller if needed
    title: task.title,
    description: task.description ?? null,
    status: task.status as TaskStatusValue,
    due_on: task.dueOn ?? null,
    created_by: task.createdBy ? String(task.createdBy) : null,
    updated_by: task.updatedBy ? String(task.updatedBy) : null,
    created_at: new Date(task.createdAt).toISOString(),
    updated_at: new Date(task.updatedAt).toISOString(),
    deleted_at: task.deletedAt ? new Date(task.deletedAt).toISOString() : null,
    accepted_at: task.acceptedAt ? new Date(task.acceptedAt).toISOString() : null,
    rank: task.rank,
  }
}

/**
 * Assignee type from Convex queries
 */
type ConvexAssignee = {
  id: string
  email: string
  fullName: string | null | undefined
  avatarUrl: string | null | undefined
}

/**
 * Task with relations from Convex queries
 */
type ConvexTaskWithRelations = Doc<'tasks'> & {
  id: string
  projectSupabaseId?: string
  assignees: (ConvexAssignee | null)[]
  commentCount: number
  attachmentCount: number
}

/**
 * Maps a Convex task with relations to the existing TaskWithRelations type
 */
function mapConvexTaskToTaskWithRelations(
  task: ConvexTaskWithRelations
): TaskWithRelations {
  const base = mapConvexTaskToDbTask(task)

  return {
    ...base,
    rank: task.rank,
    assignees: task.assignees
      .filter((a): a is ConvexAssignee => a !== null)
      .map((a) => ({ user_id: a.id })),
    commentCount: task.commentCount,
    attachmentCount: task.attachmentCount,
  }
}

/**
 * Maps a Convex task with relations to the raw format expected by assembly functions
 */
function mapConvexTaskToRaw(task: ConvexTaskWithRelations): RawTaskWithRelations {
  return {
    id: task.supabaseId ?? task._id,
    // Use projectSupabaseId if available (returned by listByProjectWithRelations),
    // otherwise fall back to projectId (Convex internal ID) for backwards compatibility
    project_id: task.projectSupabaseId ?? (task.projectId as unknown as string),
    title: task.title,
    description: task.description ?? null,
    status: task.status as TaskStatusValue,
    due_on: task.dueOn ?? null,
    created_by: task.createdBy ? String(task.createdBy) : null,
    updated_by: task.updatedBy ? String(task.updatedBy) : null,
    created_at: new Date(task.createdAt).toISOString(),
    updated_at: new Date(task.updatedAt).toISOString(),
    deleted_at: task.deletedAt ? new Date(task.deletedAt).toISOString() : null,
    accepted_at: task.acceptedAt ? new Date(task.acceptedAt).toISOString() : null,
    rank: task.rank,
    assignees: task.assignees
      .filter((a): a is ConvexAssignee => a !== null)
      .map((a) => ({ user_id: a.id, deleted_at: null })),
    comment_count: task.commentCount,
    attachment_count: task.attachmentCount,
  }
}

/**
 * Detailed task type from Convex queries
 */
type ConvexTaskDetail = Doc<'tasks'> & {
  id: string
  project: {
    id: string
    name: string
    slug: string | null
    type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
    clientId: string | null
  }
  assignees: Array<{
    id: string
    email: string
    fullName: string | null | undefined
    avatarUrl: string | null | undefined
    sortOrder: number
  } | null>
  comments: Array<{
    id: string
    body: string
    createdAt: number
    updatedAt: number
    author: {
      id: string
      email: string
      fullName: string | null | undefined
      avatarUrl: string | null | undefined
    } | null
  }>
  attachments: Array<{
    id: string
    storagePath: string
    originalName: string
    mimeType: string
    fileSize: number
    createdAt: number
  }>
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Fetch all tasks for a project
 */
export async function fetchTasksForProjectFromConvex(
  projectId: string,
  options?: { includeArchived?: boolean }
): Promise<DbTask[]> {
  try {
    const tasks = await fetchQuery(
      api.tasks.queries.listByProject,
      { projectId, includeArchived: options?.includeArchived },
      { token: await convexAuthNextjsToken() }
    )

    return tasks.map(mapConvexTaskToDbTask)
  } catch (error) {
    console.error('Failed to fetch tasks from Convex:', error)
    throw new Error('Failed to fetch tasks', { cause: error })
  }
}

/**
 * Fetch tasks for a project with relations (assignees, counts)
 *
 * Used by the kanban board view.
 */
export async function fetchTasksWithRelationsFromConvex(
  projectId: string,
  options?: { includeArchived?: boolean }
): Promise<TaskWithRelations[]> {
  try {
    const tasks = await fetchQuery(
      api.tasks.queries.listByProjectWithRelations,
      { projectId, includeArchived: options?.includeArchived },
      { token: await convexAuthNextjsToken() }
    )

    return tasks.map(mapConvexTaskToTaskWithRelations)
  } catch (error) {
    console.error('Failed to fetch tasks with relations from Convex:', error)
    throw new Error('Failed to fetch tasks with relations', { cause: error })
  }
}

/**
 * Fetch raw tasks for a project (for assembly functions)
 */
export async function fetchRawTasksFromConvex(
  projectId: string,
  options?: { includeArchived?: boolean }
): Promise<RawTaskWithRelations[]> {
  try {
    const tasks = await fetchQuery(
      api.tasks.queries.listByProjectWithRelations,
      { projectId, includeArchived: options?.includeArchived },
      { token: await convexAuthNextjsToken() }
    )

    return tasks.map(mapConvexTaskToRaw)
  } catch (error) {
    console.error('Failed to fetch raw tasks from Convex:', error)
    throw new Error('Failed to fetch raw tasks', { cause: error })
  }
}

/**
 * Fetch a task by ID
 */
export async function fetchTaskByIdFromConvex(
  taskId: string
): Promise<DbTask | null> {
  try {
    const task = await fetchQuery(
      api.tasks.queries.getById,
      { taskId },
      { token: await convexAuthNextjsToken() }
    )

    if (!task) return null

    return mapConvexTaskToDbTask(task)
  } catch (error) {
    console.error(`Failed to fetch task ${taskId} from Convex:`, error)
    throw new Error(`Failed to fetch task ${taskId}`, { cause: error })
  }
}

/**
 * Fetch a task by ID with all relations
 *
 * Used by the task detail view/sheet.
 */
export async function fetchTaskWithRelationsByIdFromConvex(taskId: string) {
  try {
    const task = await fetchQuery(
      api.tasks.queries.getByIdWithRelations,
      { taskId },
      { token: await convexAuthNextjsToken() }
    )

    if (!task) return null

    const taskDetail = task as ConvexTaskDetail

    return {
      task: {
        id: taskDetail.id,
        project_id: taskDetail.project.id,
        title: taskDetail.title,
        description: taskDetail.description ?? null,
        status: taskDetail.status as TaskStatusValue,
        due_on: taskDetail.dueOn ?? null,
        created_by: taskDetail.createdBy ? String(taskDetail.createdBy) : null,
        updated_by: taskDetail.updatedBy ? String(taskDetail.updatedBy) : null,
        created_at: new Date(taskDetail.createdAt).toISOString(),
        updated_at: new Date(taskDetail.updatedAt).toISOString(),
        deleted_at: taskDetail.deletedAt
          ? new Date(taskDetail.deletedAt).toISOString()
          : null,
        accepted_at: taskDetail.acceptedAt
          ? new Date(taskDetail.acceptedAt).toISOString()
          : null,
        rank: taskDetail.rank,
      },
      project: taskDetail.project,
      assignees: taskDetail.assignees
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => ({
          user_id: a.id,
          email: a.email,
          full_name: a.fullName ?? null,
          avatar_url: a.avatarUrl ?? null,
          sort_order: a.sortOrder,
        })),
      comments: taskDetail.comments.map((c) => ({
        id: c.id,
        task_id: taskDetail.id,
        author_id: c.author?.id ?? '',
        body: c.body,
        created_at: new Date(c.createdAt).toISOString(),
        updated_at: new Date(c.updatedAt).toISOString(),
        deleted_at: null,
        author: c.author
          ? {
              id: c.author.id,
              full_name: c.author.fullName ?? null,
              avatar_url: c.author.avatarUrl ?? null,
            }
          : null,
      })) as TaskCommentWithAuthor[],
      attachments: taskDetail.attachments.map((a) => ({
        id: a.id,
        task_id: taskDetail.id,
        storage_path: a.storagePath,
        original_name: a.originalName,
        mime_type: a.mimeType,
        file_size: a.fileSize,
        uploaded_by: '',
        created_at: new Date(a.createdAt).toISOString(),
        updated_at: new Date(a.createdAt).toISOString(),
        deleted_at: null,
      })) as DbTaskAttachment[],
    }
  } catch (error) {
    console.error(`Failed to fetch task ${taskId} with relations from Convex:`, error)
    throw new Error(`Failed to fetch task ${taskId} with relations`, { cause: error })
  }
}

/**
 * Fetch tasks assigned to the current user
 *
 * Used by the "My Tasks" view.
 */
export async function fetchMyTasksFromConvex(options?: {
  includeCompleted?: boolean
}) {
  try {
    const tasks = await fetchQuery(
      api.tasks.queries.listForCurrentUser,
      { includeCompleted: options?.includeCompleted },
      { token: await convexAuthNextjsToken() }
    )

    type TaskWithProject = Doc<'tasks'> & {
      id: string
      sortOrder: number
      project: {
        id: string
        name: string
        slug: string | null
        type: 'CLIENT' | 'PERSONAL' | 'INTERNAL'
      }
    }

    return (tasks as TaskWithProject[]).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status as TaskStatusValue,
      due_on: task.dueOn ?? null,
      sort_order: task.sortOrder,
      updated_at: new Date(task.updatedAt).toISOString(),
      project: {
        id: task.project.id,
        name: task.project.name,
        slug: task.project.slug,
        type: task.project.type,
      },
    }))
  } catch (error) {
    console.error('Failed to fetch my tasks from Convex:', error)
    throw new Error('Failed to fetch my tasks', { cause: error })
  }
}

/**
 * Fetch task collections for a project (active, accepted, archived)
 *
 * Used by the project board to separate tasks into collections.
 */
export async function fetchTaskCollectionsFromConvex(projectId: string) {
  try {
    const collections = await fetchQuery(
      api.tasks.queries.getProjectTaskCollections,
      { projectId },
      { token: await convexAuthNextjsToken() }
    )

    type TaskCollection = Doc<'tasks'> & {
      id: string
      assignees: Array<{ id: string }>
    }

    const mapCollection = (tasks: TaskCollection[]) =>
      tasks.map((task) => ({
        id: task.id,
        project_id: task.projectId as unknown as string,
        title: task.title,
        description: task.description ?? null,
        status: task.status as TaskStatusValue,
        due_on: task.dueOn ?? null,
        created_by: task.createdBy ? String(task.createdBy) : null,
        updated_by: task.updatedBy ? String(task.updatedBy) : null,
        created_at: new Date(task.createdAt).toISOString(),
        updated_at: new Date(task.updatedAt).toISOString(),
        deleted_at: task.deletedAt
          ? new Date(task.deletedAt).toISOString()
          : null,
        accepted_at: task.acceptedAt
          ? new Date(task.acceptedAt).toISOString()
          : null,
        rank: task.rank,
        assignees: task.assignees.map((a) => ({
          user_id: a.id,
          deleted_at: null,
        })),
      }))

    return {
      active: mapCollection(collections.active as TaskCollection[]),
      accepted: mapCollection(collections.accepted as TaskCollection[]),
      archived: mapCollection(collections.archived as TaskCollection[]),
    }
  } catch (error) {
    console.error('Failed to fetch task collections from Convex:', error)
    throw new Error('Failed to fetch task collections', { cause: error })
  }
}

/**
 * Fetch task count by status for a project
 */
export async function fetchTaskCountsByStatusFromConvex(
  projectId: string
): Promise<Record<string, number>> {
  try {
    const counts = await fetchQuery(
      api.tasks.queries.countByProjectStatus,
      { projectId },
      { token: await convexAuthNextjsToken() }
    )

    return counts
  } catch (error) {
    console.error('Failed to fetch task counts from Convex:', error)
    throw new Error('Failed to fetch task counts', { cause: error })
  }
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new task
 *
 * During dual-write migration, accepts optional supabaseId for ID mapping.
 */
export async function createTaskInConvex(input: {
  projectId: string
  title: string
  description?: string | null
  status?: TaskStatusValue
  dueOn?: string | null
  assigneeIds?: string[]
  supabaseId?: string
}): Promise<string> {
  const taskId = await fetchMutation(
    api.tasks.mutations.create,
    {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? undefined,
      status: input.status,
      dueOn: input.dueOn ?? undefined,
      assigneeIds: input.assigneeIds,
      supabaseId: input.supabaseId,
    },
    { token: await convexAuthNextjsToken() }
  )

  return taskId as unknown as string
}

/**
 * Update a task
 */
export async function updateTaskInConvex(
  taskId: string,
  input: {
    title?: string
    description?: string | null
    status?: TaskStatusValue
    dueOn?: string | null
    assigneeIds?: string[]
  }
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.update,
    {
      taskId,
      title: input.title,
      description: input.description,
      status: input.status,
      dueOn: input.dueOn,
      assigneeIds: input.assigneeIds,
    },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Update task status only (optimized for drag-drop)
 */
export async function updateTaskStatusInConvex(
  taskId: string,
  status: TaskStatusValue,
  rank?: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.updateStatus,
    { taskId, status, rank },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Reorder a task within its status column
 */
export async function reorderTaskInConvex(
  taskId: string,
  beforeTaskId?: string,
  afterTaskId?: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.reorder,
    { taskId, beforeTaskId, afterTaskId },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Accept a completed task (admin only)
 */
export async function acceptTaskInConvex(taskId: string): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.accept,
    { taskId },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Unaccept a task (admin only)
 */
export async function unacceptTaskInConvex(taskId: string): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.unaccept,
    { taskId },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Archive a task (soft delete)
 */
export async function archiveTaskInConvex(taskId: string): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.archive,
    { taskId },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Restore an archived task
 */
export async function restoreTaskInConvex(taskId: string): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.restore,
    { taskId },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Permanently delete a task (hard delete)
 */
export async function destroyTaskInConvex(taskId: string): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.destroy,
    { taskId },
    { token: await convexAuthNextjsToken() }
  )
}

// ============================================================
// ASSIGNEE MUTATIONS
// ============================================================

/**
 * Add an assignee to a task
 */
export async function addTaskAssigneeInConvex(
  taskId: string,
  userId: string,
  sortOrder?: number
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.addAssignee,
    { taskId, userId, sortOrder },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Remove an assignee from a task
 */
export async function removeTaskAssigneeInConvex(
  taskId: string,
  userId: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.removeAssignee,
    { taskId, userId },
    { token: await convexAuthNextjsToken() }
  )
}

// ============================================================
// COMMENT MUTATIONS
// ============================================================

/**
 * Add a comment to a task
 */
export async function addTaskCommentInConvex(
  taskId: string,
  body: string,
  supabaseId?: string
): Promise<string> {
  const result = await fetchMutation(
    api.tasks.mutations.addComment,
    { taskId, body, supabaseId },
    { token: await convexAuthNextjsToken() }
  )

  return result.commentId as unknown as string
}

/**
 * Update a comment
 */
export async function updateTaskCommentInConvex(
  commentId: string,
  body: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.updateComment,
    { commentId, body },
    { token: await convexAuthNextjsToken() }
  )
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteTaskCommentInConvex(
  commentId: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.deleteComment,
    { commentId },
    { token: await convexAuthNextjsToken() }
  )
}

// ============================================================
// ATTACHMENT MUTATIONS
// ============================================================

/**
 * Add an attachment to a task
 */
export async function addTaskAttachmentInConvex(
  taskId: string,
  attachment: {
    storagePath: string
    originalName: string
    mimeType: string
    fileSize: number
    supabaseId?: string
  }
): Promise<string> {
  const result = await fetchMutation(
    api.tasks.mutations.addAttachment,
    {
      taskId,
      storagePath: attachment.storagePath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      supabaseId: attachment.supabaseId,
    },
    { token: await convexAuthNextjsToken() }
  )

  return result.attachmentId as unknown as string
}

/**
 * Delete an attachment (soft delete)
 */
export async function deleteTaskAttachmentInConvex(
  attachmentId: string
): Promise<void> {
  await fetchMutation(
    api.tasks.mutations.deleteAttachment,
    { attachmentId },
    { token: await convexAuthNextjsToken() }
  )
}
