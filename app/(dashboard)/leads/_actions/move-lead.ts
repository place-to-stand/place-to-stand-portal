'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import { normalizeRank } from '@/lib/rank'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const moveLeadSchema = z.object({
  leadId: z.string().uuid(),
  targetStatus: z.enum(LEAD_STATUS_VALUES),
  rank: z.string().min(1, 'Rank is required'),
})

export type MoveLeadInput = z.infer<typeof moveLeadSchema>

export async function moveLead(input: MoveLeadInput): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = moveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  let normalizedRank: string

  try {
    normalizedRank = normalizeRank(parsed.data.rank)
  } catch (error) {
    console.error('Invalid rank provided for lead reorder', error)
    return {
      success: false,
      error: 'Unable to reorder lead with invalid rank.',
    }
  }

  try {
    const updated = await db
      .update(leads)
      .set({
        status: parsed.data.targetStatus,
        rank: normalizedRank,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(leads.id, parsed.data.leadId), isNull(leads.deletedAt)))
      .returning({ id: leads.id })

    if (!updated.length) {
      return { success: false, error: 'Lead not found.' }
    }
  } catch (error) {
    console.error('Failed to reorder lead', error)
    return {
      success: false,
      error: 'Unable to update lead ordering.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}
