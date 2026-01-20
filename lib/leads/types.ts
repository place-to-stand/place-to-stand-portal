import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { LeadSourceTypeValue, LeadStatusValue } from './constants'
import type { LeadSignal, PriorityTier } from './intelligence-types'

// =============================================================================
// Database Types
// =============================================================================

/**
 * Lead record as selected from the database.
 */
export type Lead = InferSelectModel<typeof leads>

/**
 * Lead with the owner's information.
 */
export type LeadWithAssignee = Lead & {
  assignee: {
    id: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  } | null
}

// =============================================================================
// Mutation Types
// =============================================================================

/**
 * Payload for creating a new lead.
 */
export type CreateLeadPayload = {
  contactName: string
  status?: LeadStatusValue
  sourceType?: LeadSourceTypeValue | null
  sourceDetail?: string | null
  assigneeId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  companyName?: string | null
  companyWebsite?: string | null
  notes?: Record<string, unknown>
}

/**
 * Payload for updating an existing lead.
 */
export type UpdateLeadPayload = {
  id: string
  contactName?: string
  status?: LeadStatusValue
  sourceType?: LeadSourceTypeValue | null
  sourceDetail?: string | null
  assigneeId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  companyName?: string | null
  companyWebsite?: string | null
  notes?: Record<string, unknown>
}

/**
 * Result of a lead mutation (create/update/delete).
 */
export type LeadMutationResult = {
  error?: string
  leadId?: string
}

// =============================================================================
// Presentation Types
// =============================================================================

/**
 * Enriched lead record for UI display.
 * Includes computed/joined fields like assignee info and formatted notes.
 */
export type LeadRecord = {
  id: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  assigneeName: string | null
  assigneeEmail: string | null
  assigneeAvatarUrl: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notesHtml: string
  rank: string
  createdAt: string
  updatedAt: string

  // AI Scoring
  overallScore: number | null
  priorityTier: PriorityTier | null
  signals: LeadSignal[]
  lastScoredAt: string | null

  // Activity Tracking
  lastContactAt: string | null
  awaitingReply: boolean

  // Predictions
  predictedCloseProbability: number | null
  estimatedValue: number | null
  expectedCloseDate: string | null

  // Conversion
  convertedAt: string | null
  convertedToClientId: string | null
}

export type LeadBoardColumnData = {
  id: LeadStatusValue
  label: string
  description: string
  leads: LeadRecord[]
}

export type LeadAssigneeOption = {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
}
