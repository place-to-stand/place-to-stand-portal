import {
  LEAD_SOURCE_TYPES,
  type LeadSourceTypeValue,
} from '@/lib/leads/constants'
import type { LeadBoardColumnData, LeadRecord } from '@/lib/leads/types'
import { matchesSearch } from '@/lib/search/text-match'

export function isLeadSourceType(
  value: string | null | undefined
): value is LeadSourceTypeValue {
  return (
    typeof value === 'string' &&
    (LEAD_SOURCE_TYPES as readonly string[]).includes(value)
  )
}

export type LeadBoardFilter = {
  /** A user id, or null for everyone's leads. */
  assigneeId: string | null
  search?: string
  source?: LeadSourceTypeValue
}

/** The fields a lead search looks in: what the card shows, plus the email. */
export function leadSearchFields(lead: {
  contactName: string
  companyName: string | null
  contactEmail: string | null
}) {
  return [lead.contactName, lead.companyName, lead.contactEmail]
}

export function matchesLeadBoardFilter(
  lead: LeadRecord,
  { assigneeId, search, source }: LeadBoardFilter
) {
  if (assigneeId && lead.assigneeId !== assigneeId) return false
  if (source && lead.sourceType !== source) return false
  return matchesSearch(leadSearchFields(lead), search)
}

/**
 * The columns to show, the leads the filters hide (which still count when a
 * drag works out a rank, so a reorder lands where it looks like it does),
 * and the leads in the owner's scope before search and source narrow it.
 */
export function splitLeadBoard(
  columns: LeadBoardColumnData[],
  filter: LeadBoardFilter
) {
  const hiddenLeads: LeadRecord[] = []
  let ownedCount = 0
  const visibleColumns = columns.map(column => ({
    ...column,
    leads: column.leads.filter(lead => {
      if (!filter.assigneeId || lead.assigneeId === filter.assigneeId) {
        ownedCount += 1
      }
      if (matchesLeadBoardFilter(lead, filter)) return true
      hiddenLeads.push(lead)
      return false
    }),
  }))
  return { visibleColumns, hiddenLeads, ownedCount }
}
