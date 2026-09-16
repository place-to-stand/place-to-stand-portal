import 'server-only'

import { z } from 'zod'

import { leadUpdateLoggedEvent } from '@/lib/activity/events'
import { logActivity } from '@/lib/activity/logger'
import { assertAdmin } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { leadUpdates } from '@/lib/db/schema'
import { LEAD_UPDATE_LABELS } from '@/lib/leads/updates'
import type { ActivitySourceValue } from '@/lib/types'

import {
  findActiveLead,
  leadUpdateBodySchema,
  leadUpdateTypeSchema,
  occurredAtSchema,
} from './lead-update-shared'

export const createLeadUpdateSchema = z.object({
  leadId: z.string().uuid(),
  type: leadUpdateTypeSchema,
  /** TipTap HTML, like `task_comments`. */
  body: leadUpdateBodySchema,
  occurredAt: occurredAtSchema.optional(),
})

export type CreateLeadUpdateInput = z.infer<typeof createLeadUpdateSchema>

export type CreateLeadUpdateResult = {
  success: boolean
  error?: string
  leadId?: string
  updateId?: string
  notFound?: boolean
}

/**
 * Log an interaction on a lead with the acting admin injected. Outside the
 * `'use server'` module so the CLI API can share it — see `saveLeadForActor`.
 * Callers own cache revalidation.
 */
export async function createLeadUpdateForActor(
  actor: AppUser,
  input: CreateLeadUpdateInput,
  source: ActivitySourceValue
): Promise<CreateLeadUpdateResult> {
  assertAdmin(actor)

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
    return { success: false, error: 'Lead not found.', notFound: true }
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
        authorId: actor.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: leadUpdates.id })

    if (!inserted) {
      return { success: false, error: 'Failed to log update.' }
    }

    await logActivity({
      actorId: actor.id,
      actorRole: actor.role,
      source,
      targetType: 'LEAD',
      targetId: leadId,
      ...leadUpdateLoggedEvent({
        contactName: lead.contactName,
        type,
        typeLabel: LEAD_UPDATE_LABELS[type],
        occurredAt: occurred,
      }),
    })

    return { success: true, leadId, updateId: inserted.id }
  } catch (error) {
    console.error('Failed to create lead update:', error)
    return {
      success: false,
      error: 'Unable to log update. Please try again.',
    }
  }
}
