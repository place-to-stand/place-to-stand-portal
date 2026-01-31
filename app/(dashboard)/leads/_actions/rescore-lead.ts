'use server'

import { requireRole } from '@/lib/auth/session'
import {
  performLeadScoring,
  type LeadScoringOperationResult,
} from '@/lib/leads/scoring'

export type RescoreLeadInput = {
  leadId: string
  force?: boolean // Force rescore even if not needed
}

export type RescoreLeadResult = LeadScoringOperationResult

/**
 * Re-score a lead using AI analysis (authenticated server action).
 * Fetches the lead's linked email threads and uses them for context.
 */
export async function rescoreLead(
  input: RescoreLeadInput
): Promise<RescoreLeadResult> {
  await requireRole('ADMIN')
  return performLeadScoring(input.leadId, input.force)
}
