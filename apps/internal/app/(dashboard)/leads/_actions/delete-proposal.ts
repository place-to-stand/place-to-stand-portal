'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { deleteProposal, fetchProposalById } from '@/lib/queries/proposals'
import { logActivity } from '@/lib/activity/logger'
import { proposalArchivedEvent } from '@/lib/activity/events/proposals'

export type DeleteProposalInput = {
  proposalId: string
}

export type DeleteProposalResult = {
  success: boolean
  error?: string
}

export async function deleteProposalAction(
  input: DeleteProposalInput
): Promise<DeleteProposalResult> {
  const user = await requireUser()
  assertAdmin(user)

  const proposal = await fetchProposalById(input.proposalId)
  if (!proposal) {
    return { success: false, error: 'Proposal not found.' }
  }

  const deleted = await deleteProposal(input.proposalId)
  if (!deleted) {
    return { success: false, error: 'Proposal not found or already deleted.' }
  }

  const event = proposalArchivedEvent({ title: proposal.title })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROPOSAL',
    targetId: proposal.id,
    metadata: event.metadata,
  })

  revalidatePath('/proposals')
  revalidatePath('/leads/board')

  return { success: true }
}
