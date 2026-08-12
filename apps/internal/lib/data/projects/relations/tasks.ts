import { and, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  taskAssignees as taskAssigneesTable,
  taskAttachments as taskAttachmentsTable,
  taskComments as taskCommentsTable,
  tasks as tasksTable,
} from '@/lib/db/schema'

import type { RawTaskWithRelations } from '../types'
import type { SelectTask } from '@/lib/queries/tasks/common'

export type TaskRow = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: SelectTask['status']
  rank: string
  acceptedAt: string | null
  completedAt: string | null
  dueOn: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  workerStatus: string | null
  commentCount: number
  attachmentCount: number
}

export type TaskAssigneeRow = {
  taskId: string
  userId: string
  deletedAt: string | null
}

export async function loadTaskRows(
  projectIds: string[],
  options: { archived?: boolean } = {}
): Promise<TaskRow[]> {
  if (!projectIds.length) {
    return []
  }

  const deletedPredicate = options.archived
    ? isNotNull(tasksTable.deletedAt)
    : isNull(tasksTable.deletedAt)

  const taskSelection = {
    id: tasksTable.id,
    projectId: tasksTable.projectId,
    title: tasksTable.title,
    description: tasksTable.description,
    status: tasksTable.status,
    rank: tasksTable.rank,
    acceptedAt: tasksTable.acceptedAt,
    completedAt: tasksTable.completedAt,
    dueOn: tasksTable.dueOn,
    createdBy: tasksTable.createdBy,
    updatedBy: tasksTable.updatedBy,
    createdAt: tasksTable.createdAt,
    updatedAt: tasksTable.updatedAt,
    deletedAt: tasksTable.deletedAt,
    githubIssueNumber: tasksTable.githubIssueNumber,
    githubIssueUrl: tasksTable.githubIssueUrl,
    workerStatus: tasksTable.workerStatus,
  } satisfies Record<string, unknown>

  const rows = await db
    .select(taskSelection)
    .from(tasksTable)
    .where(and(inArray(tasksTable.projectId, projectIds), deletedPredicate))

  if (!rows.length) {
    return []
  }

  // Two grouped queries replace the old per-row correlated subqueries,
  // which executed 2 index probes per task row per request.
  const taskIds = rows.map(row => row.id)
  const [commentCounts, attachmentCounts] = await Promise.all([
    db
      .select({
        taskId: taskCommentsTable.taskId,
        count: sql<number>`count(*)`,
      })
      .from(taskCommentsTable)
      .where(
        and(
          inArray(taskCommentsTable.taskId, taskIds),
          isNull(taskCommentsTable.deletedAt)
        )
      )
      .groupBy(taskCommentsTable.taskId),
    db
      .select({
        taskId: taskAttachmentsTable.taskId,
        count: sql<number>`count(*)`,
      })
      .from(taskAttachmentsTable)
      .where(
        and(
          inArray(taskAttachmentsTable.taskId, taskIds),
          isNull(taskAttachmentsTable.deletedAt)
        )
      )
      .groupBy(taskAttachmentsTable.taskId),
  ])

  const commentCountByTask = new Map(
    commentCounts.map(row => [row.taskId, Number(row.count)])
  )
  const attachmentCountByTask = new Map(
    attachmentCounts.map(row => [row.taskId, Number(row.count)])
  )

  return rows.map(row => ({
    ...row,
    commentCount: commentCountByTask.get(row.id) ?? 0,
    attachmentCount: attachmentCountByTask.get(row.id) ?? 0,
  }))
}

export async function loadTaskAssigneeRows(
  taskIds: string[]
): Promise<TaskAssigneeRow[]> {
  if (!taskIds.length) {
    return []
  }

  return db
    .select({
      taskId: taskAssigneesTable.taskId,
      userId: taskAssigneesTable.userId,
      deletedAt: taskAssigneesTable.deletedAt,
    })
    .from(taskAssigneesTable)
    .where(
      and(
        inArray(taskAssigneesTable.taskId, taskIds),
        isNull(taskAssigneesTable.deletedAt)
      )
    )
}

export function buildAssigneeMap(
  rows: TaskAssigneeRow[]
): Map<string, RawTaskWithRelations['assignees']> {
  const assigneesByTask = new Map<string, RawTaskWithRelations['assignees']>()

  rows.forEach(row => {
    const list = assigneesByTask.get(row.taskId) ?? []
    list.push({ user_id: row.userId, deleted_at: row.deletedAt })
    assigneesByTask.set(row.taskId, list)
  })

  return assigneesByTask
}

export function mapTaskRowsToRaw(
  rows: TaskRow[],
  assigneesByTask: Map<string, RawTaskWithRelations['assignees']>
): RawTaskWithRelations[] {
  return rows.map(row => {
    const normalized = {
      id: row.id,
      project_id: row.projectId,
      title: row.title ?? '',
      description: row.description,
      status: (row.status ?? 'ON_DECK') as RawTaskWithRelations['status'],
      rank: row.rank,
      accepted_at: row.acceptedAt,
      completed_at: row.completedAt,
      due_on: row.dueOn,
      created_by: row.createdBy ?? null,
      updated_by: row.updatedBy ?? null,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      deleted_at: row.deletedAt,
      github_issue_number: row.githubIssueNumber,
      github_issue_url: row.githubIssueUrl,
      worker_status: row.workerStatus as RawTaskWithRelations['worker_status'],
      assignees: assigneesByTask.get(row.id) ?? [],
      comment_count: Number(row.commentCount ?? 0),
      attachment_count: Number(row.attachmentCount ?? 0),
    } as RawTaskWithRelations

    return normalized
  })
}
