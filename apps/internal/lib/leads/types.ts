import type { leads } from '@/lib/db/schema'
import type { InferSelectModel } from 'drizzle-orm'
import type { OriginationMode } from '@/components/origination/types'

import type { LeadStatusValue } from './constants'
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
  originationContactId?: string | null
  originationUserId?: string | null
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
  originationContactId?: string | null
  originationUserId?: string | null
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
  /**
   * Which origination slot is populated, or null when neither is. Mirrors the
   * clients model exactly so conversion is a field copy (D13/C8) — the type is
   * IMPORTED from the shared module, never redeclared.
   */
  originationMode: OriginationMode | null
  originationContactId: string | null
  originationContactName: string | null
  originationUserId: string | null
  originationUserName: string | null
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

  /**
   * Derived last touch — `MAX(occurred_at)` over this lead's non-NOTE updates
   * (D4). Never stored: a stamped column goes stale the moment an update is
   * edited or deleted, which is what killed the retired `lastContactAt`.
   * Null when nothing has been logged.
   */
  lastTouchAt: string | null

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
 * Everything the client needs to compute staleness without reaching for a
 * server-only query or its own clock.
 *
 * `thresholds` is the `lead_stage_settings` map flattened for the RSC boundary;
 * a status absent here still falls through to `LEAD_STALE_AFTER_DAYS` (C14).
 * `now` is stamped on the server so the same day count renders during SSR and
 * hydration.
 */
export type LeadStalenessConfig = {
  thresholds: Partial<Record<LeadStatusValue, number | null>>
  now: string
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
