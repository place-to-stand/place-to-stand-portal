import type { LeadUpdateRecord } from '@/lib/leads/types'

import { isoTimestamp } from './timestamp'

export type CliLeadUpdate = {
  id: string
  leadId: string
  type: LeadUpdateRecord['type']
  /** Editor HTML, as stored. */
  body: string
  occurredAt: string
  authorId: string
  authorName: string | null
  authorEmail: string | null
  /** The AI app that logged it for the author, e.g. "Claude"; null for a person. */
  agentName: string | null
  createdAt: string
  updatedAt: string
}

export function serializeLeadUpdate(update: LeadUpdateRecord): CliLeadUpdate {
  return {
    id: update.id,
    leadId: update.leadId,
    type: update.type,
    body: update.body,
    occurredAt: isoTimestamp(update.occurredAt),
    authorId: update.authorId,
    authorName: update.authorName,
    authorEmail: update.authorEmail,
    agentName: update.agentName ?? null,
    createdAt: isoTimestamp(update.createdAt),
    updatedAt: isoTimestamp(update.updatedAt),
  }
}
