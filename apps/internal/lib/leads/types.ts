import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { LeadSourceTypeValue, LeadStatusValue } from './constants'
import type { LeadUpdateTypeValue } from './updates'

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

  // Activity Tracking
  lastContactAt: string | null
  awaitingReply: boolean

  // Predictions
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

/**
 * A single logged interaction on a lead, hydrated for the timeline.
 *
 * Author identity is denormalized the same way `LeadRecord` flattens the
 * assignee fields — it keeps the timeline from needing a round trip per row.
 */
export type LeadUpdateRecord = {
  id: string
  leadId: string
  type: LeadUpdateTypeValue
  body: string
  occurredAt: string
  authorId: string
  authorName: string | null
  authorEmail: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
}
