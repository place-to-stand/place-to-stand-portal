'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { shareDocument } from '@/lib/google/docs'
import type { GoogleProposalRef, GoogleProposalStatus } from '@/lib/leads/types'

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

  // Fetch the lead
  const leadRows = await db
    .select({
      id: leads.id,
      contactEmail: leads.contactEmail,
      googleProposals: leads.googleProposals,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  const lead = leadRows[0]

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  const proposals = (lead.googleProposals as GoogleProposalRef[]) ?? []
  const proposalIndex = proposals.findIndex(p => p.id === proposalId)

  if (proposalIndex === -1) {
    return { success: false, error: 'Proposal not found.' }
  }

  const proposal = proposals[proposalIndex]
  const now = new Date().toISOString()

  // Handle SENT status - share the document
  if (status === 'SENT') {
    const targetEmail = sendToEmail ?? lead.contactEmail

    if (!targetEmail) {
      return {
        success: false,
        error: 'No email address available. Provide an email or add one to the lead.',
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
    proposal.status = 'SENT'
    proposal.sentAt = now
    proposal.sentToEmail = targetEmail
  } else {
    // Just update the status
    proposal.status = status as GoogleProposalStatus
  }

  // Update the proposals array
  const updatedProposals = [...proposals]
  updatedProposals[proposalIndex] = proposal

  try {
    await db
      .update(leads)
      .set({
        googleProposals: updatedProposals,
        updatedAt: now,
      })
      .where(eq(leads.id, leadId))
  } catch (error) {
    console.error('Failed to update proposal status', error)
    return {
      success: false,
      error: 'Failed to update proposal status.',
    }
  }

  revalidateLeadsPath()

  return { success: true }
}
