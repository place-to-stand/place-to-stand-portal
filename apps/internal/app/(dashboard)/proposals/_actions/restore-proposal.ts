'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { restoreProposal } from '@/lib/queries/proposals'
import { logActivity } from '@/lib/activity/logger'
import { proposalRestoredEvent } from '@/lib/activity/events/proposals'

export type RestoreProposalResult = {
  success: boolean
  error?: string
}

export async function restoreProposalAction(
  proposalId: string
): Promise<RestoreProposalResult> {
  const user = await requireUser()
  assertAdmin(user)

  const restored = await restoreProposal(proposalId)
  if (!restored) {
    return { success: false, error: 'Proposal not found or not archived.' }
  }

  const event = proposalRestoredEvent({ title: restored.title })
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    verb: event.verb,
    summary: event.summary,
    targetType: 'PROPOSAL',
    targetId: restored.id,
    metadata: event.metadata,
  })

  revalidatePath('/proposals')
  revalidatePath('/proposals/archive')

  return { success: true }
}
