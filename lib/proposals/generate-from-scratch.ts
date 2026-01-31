import 'server-only'

import { addDays, format } from 'date-fns'

import { createProposal, type Proposal } from '@/lib/queries/proposals'

import {
  DEFAULT_HOURLY_RATE,
  DEFAULT_KICKOFF_DAYS,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  DEFAULT_RISKS,
} from './constants'
import type {
  ProposalContent,
  ProposalPhase,
  ProposalRisk,
  BuildProposalFromScratchInput,
} from './types'

// =============================================================================
// Main Service Function
// =============================================================================

export interface GenerateProposalFromScratchParams {
  userId: string
  input: BuildProposalFromScratchInput
}

export interface GenerateProposalFromScratchResult {
  proposal: Proposal
}

/**
 * Generate a complete proposal from scratch.
 *
 * 1. Merges input with defaults
 * 2. Saves the proposal record with content JSONB
 */
export async function generateProposalFromScratch({
  userId,
  input,
}: GenerateProposalFromScratchParams): Promise<GenerateProposalFromScratchResult> {
  const content = buildProposalContent(input)

  const expirationDate = input.proposalValidUntil
    ? format(new Date(input.proposalValidUntil), 'yyyy-MM-dd')
    : format(addDays(new Date(), DEFAULT_PROPOSAL_VALIDITY_DAYS), 'yyyy-MM-dd')

  const proposal = await createProposal({
    leadId: input.leadId,
    title: input.title,
    docUrl: null,
    docId: null,
    templateDocId: null,
    status: 'DRAFT',
    estimatedValue: input.estimatedValue !== undefined ? String(input.estimatedValue) : null,
    expirationDate,
    content,
    createdBy: userId,
  })

  return { proposal }
}

// =============================================================================
// Content Builder
// =============================================================================

/**
 * Build the full ProposalContent object from input, merging with defaults.
 */
function buildProposalContent(input: BuildProposalFromScratchInput): ProposalContent {
  // Determine risks to include
  let risks: ProposalRisk[] = []

  if (input.includeDefaultRisks !== false) {
    // Include default risks unless explicitly disabled
    risks = [...DEFAULT_RISKS]
  }

  if (input.customRisks && input.customRisks.length > 0) {
    risks = [...risks, ...input.customRisks]
  }

  // If no risks at all, use defaults
  if (risks.length === 0) {
    risks = [...DEFAULT_RISKS]
  }

  // Calculate proposal valid until date
  const proposalValidUntil = input.proposalValidUntil
    ? input.proposalValidUntil
    : addDays(new Date(), DEFAULT_PROPOSAL_VALIDITY_DAYS).toISOString()

  return {
    client: {
      companyName: input.clientCompany,
      contactName: input.clientContactName,
      contactEmail: input.clientContactEmail,
      contact2Name: input.clientContact2Name,
      contact2Email: input.clientContact2Email,
      signatoryName: input.clientSignatoryName,
    },
    projectOverviewText: input.projectOverviewText,
    phases: normalizePhases(input.phases),
    risks,
    includeDefaultRisks: input.includeDefaultRisks,
    includeFullTerms: input.includeFullTerms,
    rates: {
      hourlyRate: input.hourlyRate ?? DEFAULT_HOURLY_RATE,
      initialCommitmentDescription: input.initialCommitmentDescription,
      estimatedScopingHours: input.estimatedScopingHours,
    },
    proposalValidUntil,
    kickoffDays: input.kickoffDays ?? DEFAULT_KICKOFF_DAYS,
  }
}

/**
 * Ensure phases have sequential indexes starting from 1.
 */
function normalizePhases(phases: ProposalPhase[]): ProposalPhase[] {
  return phases.map((phase, i) => ({
    ...phase,
    index: i + 1,
  }))
}
