import { extractLeadNotes } from '@/lib/leads/notes'
import { leadHref } from '@/lib/sheets/hrefs'

import type { CliLeadRow } from '../queries/leads'

export type CliLead = {
  id: string
  name: string
  status: CliLeadRow['status']
  source: CliLeadRow['sourceType']
  sourceDetail: string | null
  assigneeId: string | null
  email: string | null
  phone: string | null
  company: string | null
  website: string | null
  /** Editor HTML, as stored. Empty string when the lead has no notes. */
  notes: string
  rank: string
  lastContactAt: string | null
  awaitingReply: boolean
  expectedCloseDate: string | null
  currentStageEnteredAt: string | null
  resolvedAt: string | null
  lossReason: CliLeadRow['lossReason']
  lossNotes: string | null
  convertedAt: string | null
  convertedToClientId: string | null
  /** Portal path that opens the lead sheet; the CLI joins it to its base URL. */
  path: string
  createdAt: string
  updatedAt: string
}

export function serializeLead(lead: CliLeadRow): CliLead {
  return {
    id: lead.id,
    name: lead.contactName,
    status: lead.status,
    source: lead.sourceType,
    sourceDetail: lead.sourceDetail,
    assigneeId: lead.assigneeId,
    email: lead.contactEmail,
    phone: lead.contactPhone,
    company: lead.companyName,
    website: lead.companyWebsite,
    notes: extractLeadNotes(lead.notes),
    rank: lead.rank,
    lastContactAt: lead.lastContactAt,
    awaitingReply: lead.awaitingReply ?? false,
    expectedCloseDate: lead.expectedCloseDate,
    currentStageEnteredAt: lead.currentStageEnteredAt,
    resolvedAt: lead.resolvedAt,
    lossReason: lead.lossReason,
    lossNotes: lead.lossNotes,
    convertedAt: lead.convertedAt,
    convertedToClientId: lead.convertedToClientId,
    path: leadHref(lead.id),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  }
}
