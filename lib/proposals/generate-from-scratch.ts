import 'server-only'

import { addDays, format } from 'date-fns'

import { buildProposalDocument } from '@/lib/google/proposal-document-builder'
import { createProposal, type Proposal } from '@/lib/queries/proposals'

import {
  DEFAULT_HOURLY_RATE,
  DEFAULT_KICKOFF_DAYS,
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  DEFAULT_RISKS,
} from './constants'
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from './document-styles'
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
  connectionId?: string
}

export interface GenerateProposalFromScratchResult {
  proposal: Proposal
  docId: string
  docUrl: string
}

/**
 * Generate a complete proposal from scratch.
 *
 * 1. Merges input with defaults
 * 2. Builds the Google Doc
 * 3. Saves the proposal record with content JSONB
 */
export async function generateProposalFromScratch({
  userId,
  input,
  connectionId,
}: GenerateProposalFromScratchParams): Promise<GenerateProposalFromScratchResult> {
  // Build the full content object with defaults
  const content = buildProposalContent(input)

  // Build document settings with defaults
  const documentSettings: DocumentSettings = {
    ...DEFAULT_DOCUMENT_SETTINGS,
    ...input.documentSettings,
  }

  // Create the Google Doc
  const { docId, docUrl } = await buildProposalDocument(
    userId,
    content,
    input.title,
    { connectionId, documentSettings }
  )

  // Calculate expiration date for the proposal record
  const expirationDate = input.proposalValidUntil
    ? format(new Date(input.proposalValidUntil), 'yyyy-MM-dd')
    : format(addDays(new Date(), DEFAULT_PROPOSAL_VALIDITY_DAYS), 'yyyy-MM-dd')

  // Save to database
  const proposal = await createProposal({
    leadId: input.leadId,
    title: input.title,
    docUrl,
    docId,
    templateDocId: null, // No template used - built from scratch
    status: 'DRAFT',
    estimatedValue: input.estimatedValue !== undefined ? String(input.estimatedValue) : null,
    expirationDate,
    content,
    createdBy: userId,
  })

  return {
    proposal,
    docId,
    docUrl,
  }
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
