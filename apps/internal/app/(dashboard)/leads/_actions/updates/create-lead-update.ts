'use server'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import {
  createLeadUpdateForActor,
  type CreateLeadUpdateInput,
} from '@/lib/leads/lead-update-core'

import type { LeadActionResult } from '../types'
import { revalidateLeadsPath } from '../utils'

export type { CreateLeadUpdateInput } from '@/lib/leads/lead-update-core'

export type CreateLeadUpdateResult = LeadActionResult & {
  updateId?: string
}

/**
 * Browser entry point; the write lives in `createLeadUpdateForActor` so the
 * CLI API can share it.
 */
export async function createLeadUpdate(
  input: CreateLeadUpdateInput
): Promise<CreateLeadUpdateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const result = await createLeadUpdateForActor(user, input, 'ADMIN_UI')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidateLeadsPath()

  return { success: true, leadId: result.leadId, updateId: result.updateId }
}
