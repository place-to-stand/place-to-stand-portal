/**
 * The lead pipeline's one move rule, shared by the board (`move-lead.ts`) and
 * the sheet, CLI and MCP save (`save-lead-core.ts`). Pure, so it is tested
 * without a database.
 */

const TERMINAL_STATUSES = new Set(['CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED'])

/**
 * Check if a status is terminal (lead lifecycle has ended).
 * Terminal statuses set resolvedAt; a Won lead may also be converted.
 */
export function isTerminalLeadStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}

export type LeadStageMoveFields = {
  currentStageEnteredAt?: string
  resolvedAt?: string | null
}

/**
 * The stamps a stage move writes, spread into the lead's `.set({...})`.
 * Nothing when the stage is unchanged. Entering a closed stage stamps
 * `resolved_at`; moving back to an open stage clears it (reopens the lead).
 * The conversion record (`converted_at`) is kept either way: a Won lead
 * moved back stays converted.
 */
export function leadStageMoveFields(
  fromStatus: string,
  toStatus: string,
  at: string
): LeadStageMoveFields {
  if (fromStatus === toStatus) return {}

  if (isTerminalLeadStatus(toStatus)) {
    return { currentStageEnteredAt: at, resolvedAt: at }
  }

  if (isTerminalLeadStatus(fromStatus)) {
    return { currentStageEnteredAt: at, resolvedAt: null }
  }

  return { currentStageEnteredAt: at }
}
