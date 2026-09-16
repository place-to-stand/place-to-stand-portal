import type { LeadUpdateRecord } from '@/lib/leads/types'

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
  createdAt: string
  updatedAt: string
}

export function serializeLeadUpdate(update: LeadUpdateRecord): CliLeadUpdate {
  return {
    id: update.id,
    leadId: update.leadId,
    type: update.type,
    body: update.body,
    occurredAt: update.occurredAt,
    authorId: update.authorId,
    authorName: update.authorName,
    authorEmail: update.authorEmail,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
  }
}
