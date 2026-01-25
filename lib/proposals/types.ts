// =============================================================================
// Proposal Content Types
// =============================================================================

/**
 * A phase in the proposal's scope of work.
 */
export interface ProposalPhase {
  /** Phase number (1, 2, 3, etc.) */
  index: number
  /** Phase title (e.g., "Discovery & Scoping") */
  title: string
  /** Purpose description */
  purpose: string
  /** List of deliverables for this phase */
  deliverables: string[]
}

/**
 * A risk item in the proposal.
 */
export interface ProposalRisk {
  /** Risk title (e.g., "Integration Complexity") */
  title: string
  /** Risk description */
  description: string
}

/**
 * Client information for the proposal.
 */
export interface ProposalClientInfo {
  /** Client company name */
  companyName: string
  /** Primary contact name */
  contactName: string
  /** Primary contact email */
  contactEmail: string
  /** Optional secondary contact name */
  contact2Name?: string
  /** Optional secondary contact email */
  contact2Email?: string
  /** Signatory name (defaults to contactName) */
  signatoryName?: string
}

/**
 * Rates and engagement terms.
 */
export interface ProposalRates {
  /** Hourly rate in USD */
  hourlyRate: number
  /** Description of initial commitment (e.g., "10-hour minimum retainer") */
  initialCommitmentDescription: string
  /** Estimated hours for scoping/first deliverable */
  estimatedScopingHours: string
}

/**
 * Complete structured content for a proposal built from scratch.
 * Stored as JSONB in the proposals.content field.
 */
export interface ProposalContent {
  // Client information
  client: ProposalClientInfo

  // Project details
  projectOverviewText: string

  // Scope of work
  phases: ProposalPhase[]

  // Risks (can be defaults or custom)
  risks: ProposalRisk[]
  includeDefaultRisks?: boolean

  // Rates and engagement
  rates: ProposalRates

  // Dates and validity
  proposalValidUntil: string // ISO date string
  kickoffDays: number
}

// =============================================================================
// Input Types for Building Proposals
// =============================================================================

/**
 * Input for creating a proposal from scratch.
 */
export interface BuildProposalFromScratchInput {
  leadId: string
  title: string

  // Client info (typically pre-filled from lead)
  clientCompany: string
  clientContactName: string
  clientContactEmail: string
  clientContact2Name?: string
  clientContact2Email?: string
  clientSignatoryName?: string

  // Project content
  projectOverviewText: string
  phases: ProposalPhase[]

  // Risks (optional - uses defaults if not provided)
  includeDefaultRisks?: boolean
  customRisks?: ProposalRisk[]

  // Rates (optional - uses defaults)
  hourlyRate?: number
  initialCommitmentDescription: string
  estimatedScopingHours: string

  // Dates (optional - uses defaults)
  proposalValidUntil?: string
  kickoffDays?: number

  // Estimated value for the proposal record
  estimatedValue?: number
}

/**
 * Result from building a proposal from scratch.
 */
export interface BuildProposalFromScratchResult {
  success: boolean
  error?: string
  proposal?: {
    id: string
    docId: string
    docUrl: string
  }
}
