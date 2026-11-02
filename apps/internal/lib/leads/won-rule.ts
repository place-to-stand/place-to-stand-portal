import type { LeadStatusValue } from '@/lib/leads/constants'

/**
 * Decision 7: a lead needs a company before it can be Won, because a won
 * lead's next step is billing that company. Shared by the sheet (inline
 * error), the board (drag revert) and `saveLeadForActor` / `moveLead`, which
 * enforce it for the app, CLI and MCP alike.
 */
export const LEAD_WON_NEEDS_COMPANY_MESSAGE =
  "Add the lead's company before marking it Won."

type LeadWonState = {
  status: LeadStatusValue
  companyId: string | null | undefined
}

/**
 * True when this write would leave the lead Won without a company. A lead
 * that was already Won without one (before the rule) can still be edited, so
 * old records don't lock up; it just can't lose a company it has.
 */
export function breaksWonNeedsCompany(
  next: LeadWonState,
  existing?: LeadWonState | null
): boolean {
  if (next.status !== 'CLOSED_WON' || next.companyId) return false
  const grandfathered = existing?.status === 'CLOSED_WON' && !existing.companyId
  return !grandfathered
}
