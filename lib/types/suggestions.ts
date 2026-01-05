import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { suggestions } from '@/lib/db/schema'

// Base types from schema
export type Suggestion = InferSelectModel<typeof suggestions>
export type NewSuggestion = InferInsertModel<typeof suggestions>

// Enum types
export type SuggestionType = 'TASK' | 'PR' | 'REPLY'
export type SuggestionStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'FAILED'
export type SuggestionPriority = 'HIGH' | 'MEDIUM' | 'LOW'

// Polymorphic suggested content types
export interface TaskSuggestedContent {
  title: string
  description?: string
  dueDate?: string
  priority?: SuggestionPriority
  assignees?: string[]
}

export interface PRSuggestedContent {
  title: string
  body: string
  branch?: string
  baseBranch?: string
  labels?: string[]
  assignees?: string[]
}

export interface ReplySuggestedContent {
  subject?: string
  body: string
}

export type SuggestedContent = TaskSuggestedContent | PRSuggestedContent | ReplySuggestedContent

// Suggestion with related context for UI
export interface SuggestionWithContext extends Suggestion {
  message?: {
    id: string
    subject: string | null
    fromEmail: string
    fromName: string | null
    sentAt: string
  } | null
  thread?: {
    id: string
    subject: string | null
    source: string
  } | null
  project?: {
    id: string
    name: string
    slug: string | null
    clientSlug: string | null
  } | null
  githubRepoLink?: {
    id: string
    repoFullName: string
    defaultBranch: string
  } | null
  createdTask?: {
    id: string
    title: string
  } | null
}

// Parsed suggestion with typed content
export interface ParsedSuggestion<T extends SuggestedContent = SuggestedContent> extends Omit<Suggestion, 'suggestedContent'> {
  suggestedContent: T
}

export interface TaskSuggestionWithContext extends SuggestionWithContext {
  type: 'TASK'
  suggestedContent: TaskSuggestedContent
}

export interface PRSuggestionWithContext extends SuggestionWithContext {
  type: 'PR'
  suggestedContent: PRSuggestedContent
}

export interface ReplySuggestionWithContext extends SuggestionWithContext {
  type: 'REPLY'
  suggestedContent: ReplySuggestedContent
}

// Suggestion summary for list views
export interface SuggestionSummary {
  id: string
  type: SuggestionType
  status: SuggestionStatus
  confidence: string
  createdAt: string
  // Type-specific preview fields
  title?: string // For TASK and PR
  body?: string // For REPLY
  message?: {
    subject: string | null
    fromEmail: string
  } | null
  project?: {
    id: string
    name: string
  } | null
}

// Approval request payload
export interface ApproveSuggestionRequest {
  modifications?: Partial<SuggestedContent>
}

// Approval result
export interface ApproveSuggestionResult {
  success: boolean
  suggestion: Suggestion
  // Type-specific created entities
  createdTaskId?: string
  createdPrNumber?: number
  createdPrUrl?: string
  error?: string
}

// Backwards compatibility aliases
/** @deprecated Use TaskSuggestionWithContext instead */
export type TaskSuggestionWithEmail = TaskSuggestionWithContext
