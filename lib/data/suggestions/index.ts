import 'server-only'

import { eq, and, isNull, desc, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  suggestions,
  messages,
  threads,
  projects,
  clients,
  tasks,
} from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import type {
  SuggestionWithContext,
  SuggestionType,
  TaskSuggestedContent,
  LeadActionSuggestedContent,
} from '@/lib/types/suggestions'

// ─────────────────────────────────────────────────────────────────────────────
// Get Suggestions
// ─────────────────────────────────────────────────────────────────────────────

export type SuggestionFilter = 'pending' | 'approved' | 'rejected' | 'all'

/**
 * Get suggestions with flexible filtering by status
 * Optionally scoped to a specific user's synced emails
 */
export async function getSuggestions(
  options: {
    limit?: number
    projectId?: string
    type?: SuggestionType
    filter?: SuggestionFilter
    userId?: string
  } = {}
): Promise<SuggestionWithContext[]> {
  const { limit = 50, projectId, type, filter = 'pending', userId } = options

  const conditions = [isNull(suggestions.deletedAt)]

  // Scope to user's threads if userId provided
  if (userId) {
    // Get thread IDs created by user
    const userThreadIds = db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.createdBy, userId), isNull(threads.deletedAt)))

    conditions.push(inArray(suggestions.threadId, userThreadIds))
  }

  // Apply status filter
  if (filter === 'pending') {
    conditions.push(
      inArray(suggestions.status, ['PENDING', 'DRAFT'])
    )
  } else if (filter === 'approved') {
    conditions.push(
      inArray(suggestions.status, ['APPROVED', 'MODIFIED'])
    )
  } else if (filter === 'rejected') {
    conditions.push(eq(suggestions.status, 'REJECTED'))
  }
  // 'all' has no status filter

  if (projectId) {
    conditions.push(eq(suggestions.projectId, projectId))
  }

  if (type) {
    conditions.push(eq(suggestions.type, type))
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  // Fetch related entities
  const messageIds = [...new Set(rows.map(s => s.messageId).filter(Boolean))] as string[]
  const threadIds = [...new Set(rows.map(s => s.threadId).filter(Boolean))] as string[]
  const projectIds = [...new Set(rows.map(s => s.projectId).filter(Boolean))] as string[]
  const createdTaskIds = [...new Set(rows.map(s => s.createdTaskId).filter(Boolean))] as string[]

  const [messageRows, threadRows, projectRows, taskRows] = await Promise.all([
    messageIds.length > 0
      ? db
          .select({
            id: messages.id,
            subject: messages.subject,
            fromEmail: messages.fromEmail,
            fromName: messages.fromName,
            sentAt: messages.sentAt,
          })
          .from(messages)
          .where(inArray(messages.id, messageIds))
      : [],
    threadIds.length > 0
      ? db
          .select({ id: threads.id, subject: threads.subject, source: threads.source })
          .from(threads)
          .where(inArray(threads.id, threadIds))
      : [],
    projectIds.length > 0
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientId: projects.clientId,
            clientName: clients.name,
            clientSlug: clients.slug,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(inArray(projects.id, projectIds))
      : [],
    createdTaskIds.length > 0
      ? db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(inArray(tasks.id, createdTaskIds))
      : [],
  ])

  const messageMap = new Map(messageRows.map(m => [m.id, m]))
  const threadMap = new Map(threadRows.map(t => [t.id, t]))
  const projectMap = new Map(
    projectRows.map(p => [
      p.id,
      {
        id: p.id,
        name: p.name,
        slug: p.slug,
        clientId: p.clientId,
        clientName: p.clientName,
        clientSlug: p.clientSlug,
      },
    ])
  )
  const taskMap = new Map(taskRows.map(t => [t.id, t]))

  return rows.map(suggestion => ({
    ...suggestion,
    message: suggestion.messageId ? messageMap.get(suggestion.messageId) ?? null : null,
    thread: suggestion.threadId ? threadMap.get(suggestion.threadId) ?? null : null,
    project: suggestion.projectId ? projectMap.get(suggestion.projectId) ?? null : null,
    createdTask: suggestion.createdTaskId ? taskMap.get(suggestion.createdTaskId) ?? null : null,
  }))
}

/**
 * Get pending suggestions for review (backwards-compatible wrapper)
 */
export function getPendingSuggestions(
  options: { limit?: number; projectId?: string; type?: SuggestionType } = {}
): Promise<SuggestionWithContext[]> {
  return getSuggestions({ ...options, filter: 'pending' })
}

/**
 * Get a single suggestion by ID with full context
 */
export async function getSuggestionById(
  suggestionId: string
): Promise<SuggestionWithContext | null> {
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, suggestionId), isNull(suggestions.deletedAt)))
    .limit(1)

  if (!suggestion) return null

  // Fetch related entities in parallel
  const [messageRow, threadRow, projectRow, taskRow] = await Promise.all([
    suggestion.messageId
      ? db
          .select({
            id: messages.id,
            subject: messages.subject,
            fromEmail: messages.fromEmail,
            fromName: messages.fromName,
            sentAt: messages.sentAt,
          })
          .from(messages)
          .where(eq(messages.id, suggestion.messageId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.threadId
      ? db
          .select({ id: threads.id, subject: threads.subject, source: threads.source })
          .from(threads)
          .where(eq(threads.id, suggestion.threadId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.projectId
      ? db
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            clientId: projects.clientId,
            clientName: clients.name,
            clientSlug: clients.slug,
          })
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(eq(projects.id, suggestion.projectId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
    suggestion.createdTaskId
      ? db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(eq(tasks.id, suggestion.createdTaskId))
          .limit(1)
          .then(rows => rows[0] ?? null)
      : null,
  ])

  return {
    ...suggestion,
    message: messageRow,
    thread: threadRow,
    project: projectRow,
    createdTask: taskRow,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Polymorphic Approve/Reject
// ─────────────────────────────────────────────────────────────────────────────

export interface ApproveTaskModifications {
  title?: string
  description?: string
  projectId?: string
  dueDate?: string
  priority?: string
  status?: 'BACKLOG' | 'ON_DECK' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE'
}

/**
 * Approve a suggestion - currently only supports TASK type
 * PR suggestions will be redesigned in a future sprint
 */
export async function approveSuggestion(
  suggestionId: string,
  userId: string,
  modifications?: ApproveTaskModifications
): Promise<{ taskId?: string }> {
  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (!['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)) {
    throw new Error('Suggestion already processed')
  }

  // Check if this is a context-linking suggestion (no task creation needed)
  const content = suggestion.suggestedContent as LeadActionSuggestedContent
  if (content.actionType === 'LINK_EMAIL_THREAD' || content.actionType === 'LINK_TRANSCRIPT') {
    return approveContextLinkSuggestion(suggestion, userId)
  }

  if (suggestion.type === 'TASK') {
    return approveTaskSuggestion(suggestion, userId, modifications)
  }

  if (suggestion.type === 'PR') {
    throw new Error('PR suggestions are not currently supported. This feature will be redesigned in a future sprint.')
  }

  throw new Error(`Unknown suggestion type: ${suggestion.type}`)
}

/**
 * Approve a TASK suggestion and create a task
 */
async function approveTaskSuggestion(
  suggestion: SuggestionWithContext,
  userId: string,
  modifications?: ApproveTaskModifications
): Promise<{ taskId: string }> {
  const content = suggestion.suggestedContent as TaskSuggestedContent

  const finalTitle = modifications?.title ?? content.title
  const finalDescription = modifications?.description ?? content.description
  const finalProjectId = modifications?.projectId ?? suggestion.projectId
  const finalDueDate = modifications?.dueDate ?? content.dueDate
  const finalStatus = modifications?.status ?? 'BACKLOG'

  if (!finalProjectId) {
    throw new Error('Project is required')
  }

  // Track if user modified the suggestion
  const wasModified =
    (modifications?.title && modifications.title !== content.title) ||
    (modifications?.description && modifications.description !== content.description) ||
    (modifications?.projectId && modifications.projectId !== suggestion.projectId)

  // Create task and update suggestion in transaction
  const result = await db.transaction(async tx => {
    const [newTask] = await tx
      .insert(tasks)
      .values({
        projectId: finalProjectId,
        title: finalTitle,
        description: finalDescription,
        dueOn: finalDueDate,
        status: finalStatus,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning()

    await tx
      .update(suggestions)
      .set({
        status: wasModified ? 'MODIFIED' : 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        createdTaskId: newTask.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suggestions.id, suggestion.id))

    return { task: newTask, wasModified }
  })

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'TASK_CREATED_FROM_SUGGESTION',
    summary: `Created task "${finalTitle}" from AI suggestion`,
    targetType: 'TASK',
    targetId: result.task.id,
    targetProjectId: finalProjectId,
    metadata: {
      suggestionId: suggestion.id,
      messageId: suggestion.messageId,
      wasModified: result.wasModified,
    },
  })

  return { taskId: result.task.id }
}

/**
 * Approve a LINK_EMAIL_THREAD or LINK_TRANSCRIPT suggestion.
 * No task is created — the approval itself "links" the context.
 * AI consumers query for approved suggestions with these action types.
 */
async function approveContextLinkSuggestion(
  suggestion: SuggestionWithContext,
  userId: string
): Promise<{ taskId?: string }> {
  const content = suggestion.suggestedContent as LeadActionSuggestedContent
  const now = new Date().toISOString()

  await db
    .update(suggestions)
    .set({
      status: 'APPROVED',
      reviewedBy: userId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(suggestions.id, suggestion.id))

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'LEAD_SUGGESTION_APPROVED',
    summary: `Approved "${content.title}" for AI context`,
    targetType: 'LEAD',
    targetId: suggestion.leadId ?? suggestion.id,
    metadata: {
      suggestionId: suggestion.id,
      actionType: content.actionType,
    },
  })

  return {}
}

/**
 * Reject a suggestion
 */
export async function rejectSuggestion(
  suggestionId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const suggestion = await getSuggestionById(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (!['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)) {
    throw new Error('Suggestion already processed')
  }

  await db
    .update(suggestions)
    .set({
      status: 'REJECTED',
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(suggestions.id, suggestionId))

  const content = suggestion.suggestedContent as TaskSuggestedContent
  const title = 'title' in content ? content.title : 'Untitled'

  await logActivity({
    actorId: userId,
    actorRole: 'ADMIN',
    verb: 'TASK_SUGGESTION_REJECTED',
    summary: `Rejected suggestion "${title}"`,
    targetType: 'TASK',
    targetId: suggestionId,
    metadata: { reason },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Counts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get suggestion counts by status
 * Optionally scoped to a specific user's synced emails
 */
export async function getSuggestionCounts(options: { userId?: string } = {}): Promise<{
  pending: number
  approved: number
  rejected: number
  byType: { TASK: number; PR: number; REPLY: number }
}> {
  const { userId } = options
  const conditions = [isNull(suggestions.deletedAt)]

  // Scope to user's threads if userId provided
  if (userId) {
    const userThreadIds = db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.createdBy, userId), isNull(threads.deletedAt)))

    conditions.push(inArray(suggestions.threadId, userThreadIds))
  }

  const results = await db
    .select({
      status: suggestions.status,
      type: suggestions.type,
      count: sql<number>`count(*)::int`,
    })
    .from(suggestions)
    .where(and(...conditions))
    .groupBy(suggestions.status, suggestions.type)

  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    byType: { TASK: 0, PR: 0, REPLY: 0 },
  }

  for (const r of results) {
    if (r.status === 'PENDING' || r.status === 'DRAFT') {
      counts.pending += r.count
      counts.byType[r.type as keyof typeof counts.byType] += r.count
    }
    if (r.status === 'APPROVED' || r.status === 'MODIFIED') counts.approved += r.count
    if (r.status === 'REJECTED') counts.rejected += r.count
  }

  return counts
}

/**
 * Get all projects for the project dropdown
 */
export async function getProjectsForDropdown(): Promise<Array<{ id: string; name: string }>> {
  const results = await db
    .select({
      id: projects.id,
      name: projects.name,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(projects.name)

  return results
}
