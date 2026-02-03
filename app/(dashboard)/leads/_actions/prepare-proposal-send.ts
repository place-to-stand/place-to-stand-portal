'use server'

import { eq, isNull, and } from 'drizzle-orm'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { enableProposalSharing } from '@/lib/data/proposals'
import { fetchProposalById, updateProposal } from '@/lib/queries/proposals'
import { serverEnv } from '@/lib/env.server'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { logActivity } from '@/lib/activity/logger'
import { proposalSentEvent } from '@/lib/activity/events'

export type PrepareProposalSendInput = {
  proposalId: string
}

export type PrepareProposalSendResult = {
  success: boolean
  error?: string
  shareUrl?: string
  proposalTitle?: string
}

/**
 * Prepares a proposal for sending by email:
 * - Auto-enables sharing if not already enabled
 * - Returns the share URL for embedding in the email
 * - Updates status to SENT with sentAt
 */
export async function prepareProposalSend(
  input: PrepareProposalSendInput
): Promise<PrepareProposalSendResult> {
  const user = await requireUser()
  assertAdmin(user)

  const proposal = await fetchProposalById(input.proposalId)
  if (!proposal) {
    return { success: false, error: 'Proposal not found.' }
  }

  // Auto-enable sharing if not already enabled
  let shareToken = proposal.shareToken
  if (!proposal.shareEnabled || !shareToken) {
    const result = await enableProposalSharing(input.proposalId)
    if (!result) {
      return { success: false, error: 'Failed to enable sharing.' }
    }
    shareToken = result.shareToken
  }

  // Update status to SENT
  if (proposal.status === 'DRAFT') {
    await updateProposal(input.proposalId, {
      status: 'SENT',
      sentAt: new Date().toISOString(),
    })
  }

  const baseUrl = serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const shareUrl = `${baseUrl}/p/${shareToken}`

  // Log activity - fetch lead name for better context
  if (proposal.leadId) {
    const [lead] = await db
      .select({ contactName: leads.contactName })
      .from(leads)
      .where(and(eq(leads.id, proposal.leadId), isNull(leads.deletedAt)))
      .limit(1)

    if (lead) {
      const event = proposalSentEvent({
        title: proposal.title,
        leadName: lead.contactName,
      })
      await logActivity({
        actorId: user.id,
        verb: event.verb,
        summary: event.summary,
        targetType: 'PROPOSAL',
        targetId: proposal.id,
        metadata: event.metadata,
      })
    }
  }

  return {
    success: true,
    shareUrl,
    proposalTitle: proposal.title,
  }
}
