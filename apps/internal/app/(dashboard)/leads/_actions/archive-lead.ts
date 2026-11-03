'use server'

import { z } from 'zod'

import { requireCrmUser } from '@/lib/auth/session'
import { NotFoundError } from '@/lib/errors/http'
import { setLeadArchived } from '@/lib/leads/archive'
import { revalidateLeadsPath } from '@/lib/leads/revalidate'

import type { LeadActionResult } from './types'

const schema = z.object({ leadId: z.guid() })

export async function archiveLead(
  input: z.infer<typeof schema>
): Promise<LeadActionResult> {
  const user = await requireCrmUser()
  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: 'Invalid lead reference.' }
  }

  try {
    await setLeadArchived(user, parsed.data.leadId, true)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { success: false, error: error.message }
    }
    console.error('Failed to archive lead', error)
    return {
      success: false,
      error: 'Unable to archive lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
