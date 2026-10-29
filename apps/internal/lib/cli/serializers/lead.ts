import { extractLeadNotes } from '@/lib/leads/notes'
import { leadHref } from '@/lib/sheets/hrefs'

import type { CliLeadRow } from '../queries/leads'
import { isoTimestamp } from './timestamp'

/**
 * `lastContactAt`, `awaitingReply` and `expectedCloseDate` exist on the row
 * but nothing in the app writes them (PRD 006 left them write-never), so they
 * are deliberately not exported — a null there reads as "never contacted",
 * which is wrong. Last touch is the newest entry in `leads updates`.
 */
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
  /** The linked company record, when the company name matched one. */
  companyId: string | null
  /** The lead's contact record; name, email and phone are its details. */
  contactId: string | null
  /** Editor HTML, as stored. Empty string when the lead has no notes. */
  notes: string
  rank: string
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
    companyId: lead.companyId,
    contactId: lead.contactId,
    notes: extractLeadNotes(lead.notes),
    rank: lead.rank,
    currentStageEnteredAt: isoTimestamp(lead.currentStageEnteredAt),
    resolvedAt: isoTimestamp(lead.resolvedAt),
    lossReason: lead.lossReason,
    lossNotes: lead.lossNotes,
    convertedAt: isoTimestamp(lead.convertedAt),
    convertedToClientId: lead.convertedToClientId,
    path: leadHref(lead.id),
    createdAt: isoTimestamp(lead.createdAt),
    updatedAt: isoTimestamp(lead.updatedAt),
  }
}
