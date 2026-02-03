'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { deleteProposal } from '@/lib/queries/proposals'

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

  const deleted = await deleteProposal(input.proposalId)
  if (!deleted) {
    return { success: false, error: 'Proposal not found or already deleted.' }
  }

  revalidatePath('/proposals')
  revalidatePath('/leads/board')

  return { success: true }
}
