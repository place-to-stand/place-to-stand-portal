import 'server-only'

import { and, desc, eq, isNull, inArray, or } from 'drizzle-orm'

import { db } from '@/lib/db'
import { suggestions, threads } from '@/lib/db/schema'
import type {
  Suggestion,
  SuggestionSummary,
  SuggestionType,
  SuggestionStatus,
  TaskSuggestedContent,
  PRSuggestedContent,
  LeadActionSuggestedContent,
} from '@/lib/types/suggestions'

export type CreateSuggestionInput = {
  messageId?: string | null
  threadId?: string | null
  leadId?: string | null
  type: SuggestionType
  status?: SuggestionStatus
  projectId?: string | null
  confidence: number
  reasoning?: string | null
  aiModelVersion?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  suggestedContent: TaskSuggestedContent | PRSuggestedContent | LeadActionSuggestedContent
}

export async function createSuggestion(input: CreateSuggestionInput): Promise<Suggestion> {
  const [suggestion] = await db
    .insert(suggestions)
    .values({
      messageId: input.messageId ?? null,
      threadId: input.threadId ?? null,
      leadId: input.leadId ?? null,
      type: input.type,
      status: input.status ?? 'PENDING',
      projectId: input.projectId ?? null,
      confidence: input.confidence.toString(),
      reasoning: input.reasoning ?? null,
      aiModelVersion: input.aiModelVersion ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      suggestedContent: input.suggestedContent,
    })
    .returning()

  return suggestion
}

export interface SuggestionForLead extends SuggestionSummary {
  thread: {
    id: string
    subject: string | null
  } | null
  suggestedContent: TaskSuggestedContent | PRSuggestedContent | LeadActionSuggestedContent
  reasoning: string | null
}

export async function getSuggestionsForLead(
  leadId: string,
  options: { pendingOnly?: boolean; type?: SuggestionType; limit?: number } = {}
): Promise<SuggestionForLead[]> {
  const { pendingOnly = true, type, limit = 50 } = options

  const conditions = [
    eq(suggestions.leadId, leadId),
    isNull(suggestions.deletedAt),
  ]

  if (pendingOnly) {
    conditions.push(
      or(
        eq(suggestions.status, 'PENDING'),
        eq(suggestions.status, 'DRAFT'),
        eq(suggestions.status, 'MODIFIED')
      )!
    )
  }

  if (type) {
    conditions.push(eq(suggestions.type, type))
  }

  const rows = await db
    .select()
    .from(suggestions)
    .where(and(...conditions))
    .orderBy(desc(suggestions.confidence), desc(suggestions.createdAt))
    .limit(limit)

  if (rows.length === 0) return []

  const threadIds = [...new Set(rows.map(s => s.threadId).filter(Boolean))] as string[]
  const threadRows = threadIds.length > 0
    ? await db
        .select({
          id: threads.id,
          subject: threads.subject,
        })
        .from(threads)
        .where(inArray(threads.id, threadIds))
    : []
  const threadMap = new Map(threadRows.map(t => [t.id, t]))

  return rows.map(suggestion => {
    const content = suggestion.suggestedContent as TaskSuggestedContent | PRSuggestedContent | LeadActionSuggestedContent
    const rawContent = suggestion.suggestedContent as Record<string, unknown>
    return {
      id: suggestion.id,
      type: suggestion.type as SuggestionType,
      status: suggestion.status as SuggestionStatus,
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt,
      title: typeof rawContent.title === 'string' ? rawContent.title : undefined,
      body: typeof rawContent.body === 'string' && !rawContent.title ? rawContent.body : undefined,
      message: null,
      project: null,
      lead: null,
      thread: suggestion.threadId ? threadMap.get(suggestion.threadId) ?? null : null,
      suggestedContent: content,
      reasoning: suggestion.reasoning,
    }
  })
}
