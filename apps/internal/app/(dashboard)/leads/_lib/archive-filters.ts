import type { ArchivedLead } from '@/lib/data/leads'
import { LEAD_STATUS_VALUES, type LeadStatusValue } from '@/lib/leads/constants'

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
  const needle = q?.trim().toLowerCase()

  let filtered = statusFilter
    ? leads.filter(lead => lead.status === statusFilter)
    : leads
  // Search over the fields the table shows.
  if (needle) {
    filtered = filtered.filter(lead =>
      [lead.contactName, lead.companyName, lead.contactEmail].some(field =>
        field?.toLowerCase().includes(needle)
      )
    )
  }
  return filtered
}
