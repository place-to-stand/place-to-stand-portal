'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { shareDocument } from '@/lib/google/docs'
import {
  fetchProposalById,
  updateProposal,
  type ProposalStatus,
} from '@/lib/queries/proposals'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const PROPOSAL_STATUSES = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'] as const

const updateProposalStatusSchema = z.object({
  leadId: z.string().uuid(),
  proposalId: z.string().uuid(),
  status: z.enum(PROPOSAL_STATUSES),
  /** For SENT status - email to share with */
  sendToEmail: z.string().email().optional(),
  /** Whether to grant edit access (default: view only) */
  grantEditAccess: z.boolean().optional(),
})

export type UpdateProposalStatusInput = z.infer<typeof updateProposalStatusSchema>

export async function updateProposalStatus(
  input: UpdateProposalStatusInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = updateProposalStatusSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const { leadId, proposalId, status, sendToEmail, grantEditAccess } = parsed.data

  // Fetch the proposal from the proposals table
  const proposal = await fetchProposalById(proposalId)

  if (!proposal) {
    return { success: false, error: 'Proposal not found.' }
  }

  // Verify the proposal belongs to this lead
  if (proposal.leadId !== leadId) {
    return { success: false, error: 'Proposal does not belong to this lead.' }
  }

  // For SENT status, we need to get the lead's email if not provided
  let targetEmail = sendToEmail

  if (status === 'SENT' && !targetEmail) {
    const leadRows = await db
      .select({ contactEmail: leads.contactEmail })
      .from(leads)
      .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
      .limit(1)

    targetEmail = leadRows[0]?.contactEmail ?? undefined
  }

  // Handle SENT status - share the document
  if (status === 'SENT') {
    if (!targetEmail) {
      return {
        success: false,
        error: 'No email address available. Provide an email or add one to the lead.',
      }
    }

    if (!proposal.docId) {
      return {
        success: false,
        error: 'Proposal has no associated document.',
      }
    }

    try {
      await shareDocument(user.id, {
        docId: proposal.docId,
        email: targetEmail,
        role: grantEditAccess ? 'writer' : 'reader',
        sendNotification: true,
        emailMessage: `Please find your proposal document attached. You can view it at any time using this link.`,
      })
    } catch (error) {
      console.error('Failed to share proposal document', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to share proposal. Please check your Google connection.',
      }
    }

    // Update proposal with sent info
    const now = new Date().toISOString()
    try {
      await updateProposal(proposalId, {
        status: 'SENT' as ProposalStatus,
        sentAt: now,
        sentToEmail: targetEmail,
      })
    } catch (error) {
      console.error('Failed to update proposal status', error)
      return {
        success: false,
        error: 'Failed to update proposal status.',
      }
    }
  } else {
    // Just update the status
    try {
      await updateProposal(proposalId, {
        status: status as ProposalStatus,
      })
    } catch (error) {
      console.error('Failed to update proposal status', error)
      return {
        success: false,
        error: 'Failed to update proposal status.',
      }
    }
  }

  revalidateLeadsPath()

  return { success: true }
}
