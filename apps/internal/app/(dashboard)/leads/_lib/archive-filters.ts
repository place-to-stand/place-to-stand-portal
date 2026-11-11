import type { ArchivedLead } from '@/lib/data/leads'
import { matchesSearch } from '@/lib/search/text-match'
import { LEAD_STATUS_VALUES, type LeadStatusValue } from '@/lib/leads/constants'
import { leadSearchFields } from './board-filters'

export function isLeadStatus(
  value: string | null | undefined
): value is LeadStatusValue {
  return (
    typeof value === 'string' &&
    (LEAD_STATUS_VALUES as readonly string[]).includes(value)
  )
}

/**
 * The archive's in-memory `?status=` / `?q=` filter (PRD 004 §03). Shared by
 * the page (for the header's "Showing X of Y" count) and the table.
 */
export function filterArchivedLeads(
  leads: ArchivedLead[],
  { status, q }: { status?: string | null; q?: string | null }
): ArchivedLead[] {
  const statusFilter = isLeadStatus(status) ? status : undefined
  let filtered = statusFilter
    ? leads.filter(lead => lead.status === statusFilter)
    : leads
  // The same search as the board.
  if (q?.trim()) {
    filtered = filtered.filter(lead => matchesSearch(leadSearchFields(lead), q))
  }
  return filtered
}
