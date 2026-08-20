'use server'

import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity/logger'
import { leadUpdateLoggedEvent } from '@/lib/activity/events'
import { db } from '@/lib/db'
import { leadUpdates } from '@/lib/db/schema'
import { LEAD_UPDATE_LABELS } from '@/lib/leads/updates'

import type { LeadActionResult } from '../types'
import { revalidateLeadsPath } from '../utils'
import {
  findActiveLead,
  leadUpdateBodySchema,
  leadUpdateTypeSchema,
  occurredAtSchema,
} from './shared'

const createLeadUpdateSchema = z.object({
  leadId: z.string().uuid(),
  type: leadUpdateTypeSchema,
  body: leadUpdateBodySchema,
  occurredAt: occurredAtSchema.optional(),
})

export type CreateLeadUpdateInput = z.infer<typeof createLeadUpdateSchema>

export type CreateLeadUpdateResult = LeadActionResult & {
  updateId?: string
}

export async function createLeadUpdate(
  input: CreateLeadUpdateInput
): Promise<CreateLeadUpdateResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = createLeadUpdateSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid update payload.',
    }
  }

  const { leadId, type, body, occurredAt } = parsed.data

  const lead = await findActiveLead(leadId)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  try {
    const timestamp = new Date().toISOString()
    const occurred = occurredAt ?? timestamp

    const [inserted] = await db
      .insert(leadUpdates)
      .values({
        leadId,
        type,
        body,
        occurredAt: occurred,
        authorId: user.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: leadUpdates.id })

    if (!inserted) {
      return { success: false, error: 'Failed to log update.' }
    }

    await logActivity({
      actorId: user.id,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadUpdateLoggedEvent({
        contactName: lead.contactName,
        type,
        typeLabel: LEAD_UPDATE_LABELS[type],
        occurredAt: occurred,
      }),
    })

    revalidateLeadsPath()

    return { success: true, leadId, updateId: inserted.id }
  } catch (error) {
    console.error('Failed to create lead update:', error)
    return {
      success: false,
      error: 'Unable to log update. Please try again.',
    }
  }
}
