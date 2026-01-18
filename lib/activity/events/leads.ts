import { ActivityVerbs, type ActivityEvent } from '@/lib/activity/types'
import type { PriorityTier } from '@/lib/leads/intelligence-types'

import { toMetadata } from './shared'

export const leadCreatedEvent = (args: {
  contactName: string
  status?: string
  sourceType?: string | null
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_CREATED,
  summary: `Created lead "${args.contactName}"`,
  metadata: toMetadata({
    lead: {
      contactName: args.contactName,
      status: args.status ?? null,
      sourceType: args.sourceType ?? null,
    },
  }),
})

export const leadUpdatedEvent = (args: {
  contactName: string
  changedFields: string[]
  details?: Record<string, unknown>
}): ActivityEvent => {
  const fields = args.changedFields
  const fieldSummary = fields.length ? ` (${fields.join(', ')})` : ''

  return {
    verb: ActivityVerbs.LEAD_UPDATED,
    summary: `Updated lead "${args.contactName}"${fieldSummary}`,
    metadata: toMetadata({
      changedFields: fields,
      details: args.details ?? undefined,
    }),
  }
}

export const leadStatusChangedEvent = (args: {
  contactName: string
  fromStatus: string
  toStatus: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_STATUS_CHANGED,
  summary: `Moved lead "${args.contactName}" from ${args.fromStatus} to ${args.toStatus}`,
  metadata: toMetadata({
    status: {
      from: args.fromStatus,
      to: args.toStatus,
    },
  }),
})

export const leadScoredEvent = (args: {
  contactName: string
  previousScore: number | null
  newScore: number
  signalCount: number
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_SCORED,
  summary: `Lead "${args.contactName}" score updated to ${args.newScore}`,
  metadata: toMetadata({
    scoring: {
      previousScore: args.previousScore,
      newScore: args.newScore,
      signalCount: args.signalCount,
    },
  }),
})

export const leadPriorityChangedEvent = (args: {
  contactName: string
  previousTier: PriorityTier | null
  newTier: PriorityTier
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_PRIORITY_CHANGED,
  summary: `Lead "${args.contactName}" priority changed to ${args.newTier}`,
  metadata: toMetadata({
    priority: {
      previousTier: args.previousTier,
      newTier: args.newTier,
    },
  }),
})

export const leadConvertedEvent = (args: {
  leadId: string
  leadName: string
  clientId: string
  clientName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_CONVERTED,
  summary: `Converted lead "${args.leadName}" to client "${args.clientName}"`,
  metadata: toMetadata({
    conversion: {
      leadId: args.leadId,
      clientId: args.clientId,
      clientName: args.clientName,
    },
  }),
})

export const leadArchivedEvent = (args: {
  contactName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_ARCHIVED,
  summary: `Archived lead "${args.contactName}"`,
})

export const leadRestoredEvent = (args: {
  contactName: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_RESTORED,
  summary: `Restored lead "${args.contactName}"`,
})

export const leadSuggestionApprovedEvent = (args: {
  contactName: string
  suggestionType: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_SUGGESTION_APPROVED,
  summary: `Approved ${args.suggestionType} suggestion for lead "${args.contactName}"`,
  metadata: toMetadata({
    suggestionType: args.suggestionType,
  }),
})

export const leadSuggestionDismissedEvent = (args: {
  contactName: string
  suggestionType: string
}): ActivityEvent => ({
  verb: ActivityVerbs.LEAD_SUGGESTION_DISMISSED,
  summary: `Dismissed ${args.suggestionType} suggestion for lead "${args.contactName}"`,
  metadata: toMetadata({
    suggestionType: args.suggestionType,
  }),
})
