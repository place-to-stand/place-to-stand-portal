import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { LeadSourceTypeValue, LeadStatusValue } from './constants'
import type { LeadSignal, PriorityTier } from './intelligence-types'

// =============================================================================
// Google Integration Types
// =============================================================================

/**
 * Reference to a Google Calendar meeting with Meet link.
 * Stored as JSONB in the leads table.
 */
export type GoogleMeetingRef = {
  /** Local UUID for reference */
  id: string
  /** Google Calendar event ID */
  eventId: string
  /** Google Meet link (null if Meet not enabled) */
  meetLink: string | null
  /** Meeting title */
  title: string
  /** ISO datetime when meeting starts */
  startsAt: string
  /** ISO datetime when meeting ends */
  endsAt: string
  /** Attendee email addresses */
  attendeeEmails: string[]
  /** ISO datetime when created */
  createdAt: string
  /** User ID who created the meeting */
  createdBy: string
}

/** Proposal document status */
export type GoogleProposalStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'

/**
 * Reference to a Google Docs proposal document.
 * Stored as JSONB in the leads table.
 */
export type GoogleProposalRef = {
  /** Local UUID for reference */
  id: string
  /** Google Docs document ID */
  docId: string
  /** Full URL to the document */
  docUrl: string
  /** Source template doc ID (from settings, null if blank doc) */
  templateDocId: string | null
  /** Document title */
  title: string
  /** Proposal lifecycle status */
  status: GoogleProposalStatus
  /** ISO datetime when sent to lead */
  sentAt: string | null
  /** Email address proposal was sent to */
  sentToEmail: string | null
  /** ISO datetime when created */
  createdAt: string
  /** User ID who created the proposal */
  createdBy: string
}

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

  // Google Integrations
  googleMeetings: GoogleMeetingRef[]
  googleProposals: GoogleProposalRef[]
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
