import 'server-only'

import { cache } from 'react'
import { hash, compare } from 'bcryptjs'

import {
  fetchProposalById,
  fetchProposalByShareToken,
  fetchAllProposals,
  updateProposal,
  recordProposalView,
  recordProposalResponse,
  type Proposal,
  type ProposalStatus,
  type ProposalWithRelations,
} from '@/lib/queries/proposals'

// =============================================================================
// Token generation
// =============================================================================

/**
 * Generate a URL-safe random token for sharing.
 */
function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

// =============================================================================
// Sharing management (admin-facing)
// =============================================================================

/**
 * Enable sharing for a proposal. Generates a token if none exists.
 * Optionally sets a password.
 */
export async function enableProposalSharing(
  proposalId: string,
  password?: string | null
): Promise<{ shareToken: string } | null> {
  const proposal = await fetchProposalById(proposalId)
  if (!proposal) return null

  const shareToken = proposal.shareToken ?? generateShareToken()
  const sharePasswordHash = password ? await hash(password, 10) : proposal.sharePasswordHash ?? null

  await updateProposal(proposalId, {
    shareToken,
    sharePasswordHash,
    shareEnabled: true,
  })

  return { shareToken }
}

/**
 * Disable sharing for a proposal. Keeps the token for re-enabling.
 */
export async function disableProposalSharing(
  proposalId: string
): Promise<boolean> {
  const result = await updateProposal(proposalId, { shareEnabled: false })
  return result !== null
}

/**
 * Update the password for a shared proposal.
 */
export async function updateSharePassword(
  proposalId: string,
  password: string | null
): Promise<boolean> {
  const passwordHash = password ? await hash(password, 10) : null
  const result = await updateProposal(proposalId, {
    sharePasswordHash: passwordHash,
  })
  return result !== null
}

// =============================================================================
// Public access (unauthenticated)
// =============================================================================

/**
 * Verify a password against a shared proposal.
 * Returns the proposal if password is correct or no password is set.
 */
export async function verifySharePassword(
  token: string,
  password?: string
): Promise<{ ok: true; proposal: Proposal } | { ok: false; needsPassword: boolean }> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return { ok: false, needsPassword: false }

  if (proposal.sharePasswordHash) {
    if (!password) return { ok: false, needsPassword: true }
    const valid = await compare(password, proposal.sharePasswordHash)
    if (!valid) return { ok: false, needsPassword: true }
  }

  return { ok: true, proposal }
}

/**
 * Record a view and return the proposal for display.
 */
export async function viewSharedProposal(token: string): Promise<Proposal | null> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return null

  await recordProposalView(proposal.id)
  return proposal
}

/**
 * Record a client response (accept/reject) on a shared proposal.
 */
export async function respondToProposal(
  token: string,
  action: 'ACCEPTED' | 'REJECTED',
  comment?: string | null
): Promise<Proposal | null> {
  const proposal = await fetchProposalByShareToken(token)
  if (!proposal) return null

  // Don't allow changing a response once set
  if (proposal.acceptedAt || proposal.rejectedAt) return null

  return recordProposalResponse(proposal.id, action, comment)
}

// =============================================================================
// Dashboard data
// =============================================================================

export const fetchProposalsDashboard = cache(
  async (statusFilter?: ProposalStatus[]) => {
    return fetchAllProposals(statusFilter)
  }
)

export type { Proposal, ProposalStatus, ProposalWithRelations }
