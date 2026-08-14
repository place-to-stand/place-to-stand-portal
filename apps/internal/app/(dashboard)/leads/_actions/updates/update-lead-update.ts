'use server'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates } from '@/lib/db/schema'
import { getLeadUpdateForLead } from '@/lib/queries/lead-updates'

import type { LeadActionResult } from '../types'
import { revalidateLeadsPath } from '../utils'
import {
  findActiveLead,
  leadUpdateBodySchema,
  leadUpdateTypeSchema,
  occurredAtSchema,
} from './shared'

const updateLeadUpdateSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  type: leadUpdateTypeSchema,
  body: leadUpdateBodySchema,
  occurredAt: occurredAtSchema,
})

export type UpdateLeadUpdateInput = z.infer<typeof updateLeadUpdateSchema>

export async function updateLeadUpdate(
  input: UpdateLeadUpdateInput
): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = updateLeadUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  const { id, leadId, type, body, occurredAt } = parsed.data

  const lead = await findActiveLead(leadId)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  // Verify the update belongs to THIS lead — the id alone is not trustworthy.
  const existing = await getLeadUpdateForLead(id, leadId)

  if (!existing) {
    return { success: false, error: 'Update not found.' }
  }

  try {
    await db
      .update(leadUpdates)
      .set({
        type,
        body,
        occurredAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(leadUpdates.id, id))

    revalidateLeadsPath()

    return { success: true, leadId }
  } catch (error) {
    console.error('Failed to update lead update:', error)
    return {
      success: false,
      error: 'Unable to save update. Please try again.',
    }
  }
}
