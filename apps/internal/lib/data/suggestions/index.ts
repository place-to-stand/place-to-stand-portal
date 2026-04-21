import 'server-only'

import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { suggestions, tasks } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import type {
  Suggestion,
  TaskSuggestedContent,
} from '@/lib/types/suggestions'

async function fetchSuggestion(suggestionId: string): Promise<Suggestion | null> {
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, suggestionId), isNull(suggestions.deletedAt)))
    .limit(1)
  return suggestion ?? null
}

export interface ApproveTaskModifications {
  title?: string
  description?: string
  projectId?: string
  dueDate?: string
  priority?: string
  status?: 'ON_DECK' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'
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
  const suggestion = await fetchSuggestion(suggestionId)

  if (!suggestion) {
    throw new Error('Suggestion not found')
  }

  if (!['PENDING', 'DRAFT', 'MODIFIED'].includes(suggestion.status)) {
    throw new Error('Suggestion already processed')
  }

  if (suggestion.type === 'TASK') {
    return approveTaskSuggestion(suggestion, userId, modifications)
  }

  if (suggestion.type === 'PR') {
    throw new Error('PR suggestions are not currently supported. This feature will be redesigned in a future sprint.')
  }

  throw new Error(`Unknown suggestion type: ${suggestion.type}`)
}

async function approveTaskSuggestion(
  suggestion: Suggestion,
  userId: string,
  modifications?: ApproveTaskModifications
): Promise<{ taskId: string }> {
  const content = suggestion.suggestedContent as TaskSuggestedContent

  const finalTitle = modifications?.title ?? content.title
  const finalDescription = modifications?.description ?? content.description
  const finalProjectId = modifications?.projectId ?? suggestion.projectId
  const finalDueDate = modifications?.dueDate ?? content.dueDate
  const finalStatus = modifications?.status ?? 'ON_DECK'

  if (!finalProjectId) {
    throw new Error('Project is required')
  }

  const wasModified =
    (modifications?.title && modifications.title !== content.title) ||
    (modifications?.description && modifications.description !== content.description) ||
    (modifications?.projectId && modifications.projectId !== suggestion.projectId)

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

export async function rejectSuggestion(
  suggestionId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const suggestion = await fetchSuggestion(suggestionId)

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
