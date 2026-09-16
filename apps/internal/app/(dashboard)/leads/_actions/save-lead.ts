'use server'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { saveLeadForActor } from '@/lib/leads/save-lead-core'
import type { SaveLeadInput } from '@/lib/leads/save-lead-fields'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

export type { SaveLeadInput } from '@/lib/leads/save-lead-fields'

/**
 * Browser entry point. The actual write lives in `saveLeadForActor` so the
 * CLI API can share it without this module's session coupling.
 */
export async function saveLead(input: SaveLeadInput): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const result = await saveLeadForActor(user, input, 'ADMIN_UI')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidateLeadsPath()

  return { success: true, leadId: result.leadId }
}
