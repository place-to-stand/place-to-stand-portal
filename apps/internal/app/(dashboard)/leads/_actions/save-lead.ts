'use server'

import { and, eq, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contactLeads, leads, leadStageHistory } from '@/lib/db/schema'
import {
  LEAD_STATUS_VALUES,
  isTerminalLeadStatus,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { serializeLeadNotes } from '@/lib/leads/notes'
import { resolveNextLeadRank } from '@/lib/leads/rank'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const saveLeadSchema = z.object({
  id: z.string().uuid().optional(),
  contactName: z
    .string()
    .trim()
    .min(1, 'Contact name is required')
    .max(160),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  originationMode: z.enum(['internal', 'external']).optional().nullable(),
  originationContactId: z.string().uuid().optional().nullable(),
  originationUserId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  contactEmail: z.string().trim().max(160).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  companyWebsite: z.string().trim().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type SaveLeadInput = z.infer<typeof saveLeadSchema>

export async function saveLead(input: SaveLeadInput): Promise<LeadActionResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = saveLeadSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid lead payload.',
    }
  }

  let normalized: ReturnType<typeof normalizeLeadPayload>

  try {
    normalized = normalizeLeadPayload(parsed.data)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid lead payload.',
    }
  }
  const timestamp = new Date().toISOString()

  let createdLeadId: string | undefined

  try {
    if (!normalized.id) {
      const rank = await resolveNextLeadRank(normalized.status)

      const inserted = await db.insert(leads).values({
        contactName: normalized.contactName,
        status: normalized.status,
        originationContactId: normalized.originationContactId,
        originationUserId: normalized.originationUserId,
        assigneeId: normalized.assigneeId,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        companyName: normalized.companyName,
        companyWebsite: normalized.companyWebsite,
        notes: serializeLeadNotes(normalized.notes),
        rank,
        currentStageEnteredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).returning({ id: leads.id })

      createdLeadId = inserted[0]?.id
      if (createdLeadId) {
        await syncContactLeadLink(
          createdLeadId,
          normalized.originationContactId
        )

        await db.insert(leadStageHistory).values({
          leadId: createdLeadId,
          fromStatus: null,
          toStatus: normalized.status,
          changedAt: timestamp,
          changedBy: user.id,
        })
      }
    } else {
      const existingRows = await db
        .select({
          id: leads.id,
          status: leads.status,
          rank: leads.rank,
        })
        .from(leads)
        .where(and(eq(leads.id, normalized.id), isNull(leads.deletedAt)))
        .limit(1)

      const existing = existingRows[0]

      if (!existing) {
        return { success: false, error: 'Lead not found.' }
      }

      let rank = existing.rank
      const statusChanged = existing.status !== normalized.status

      if (statusChanged) {
        rank = await resolveNextLeadRank(normalized.status)
      }

      const setPayload: Record<string, unknown> = {
        contactName: normalized.contactName,
        status: normalized.status,
        originationContactId: normalized.originationContactId,
        originationUserId: normalized.originationUserId,
        assigneeId: normalized.assigneeId,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        companyName: normalized.companyName,
        companyWebsite: normalized.companyWebsite,
        notes: serializeLeadNotes(normalized.notes),
        rank,
        updatedAt: timestamp,
      }

      if (statusChanged) {
        setPayload.currentStageEnteredAt = timestamp

        if (isTerminalLeadStatus(normalized.status)) {
          setPayload.resolvedAt = timestamp
        }

        // Reset conversion/resolution fields when moving back to an active stage
        if (isTerminalLeadStatus(existing.status) && !isTerminalLeadStatus(normalized.status)) {
          setPayload.resolvedAt = null
          setPayload.convertedAt = null
          setPayload.convertedToClientId = null
          setPayload.lossReason = null
          setPayload.lossNotes = null
        }
      }

      await db
        .update(leads)
        .set(setPayload)
        .where(eq(leads.id, normalized.id))

      await syncContactLeadLink(
        normalized.id,
        normalized.originationContactId
      )

      if (statusChanged) {
        await db.insert(leadStageHistory).values({
          leadId: normalized.id,
          fromStatus: existing.status,
          toStatus: normalized.status,
          changedAt: timestamp,
          changedBy: user.id,
        })
      }
    }
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true, leadId: createdLeadId }
}

/**
 * Keep `contact_leads` in step with the lead's origination contact.
 *
 * `origination_contact_id` stays the authoritative single referrer;
 * `contact_leads` is the queryable link that lets a contact's page answer
 * "which leads did this person refer?".
 *
 * Clearing or changing the referrer is a HARD delete: `contact_leads` has no
 * `deletedAt` (its columns are `id, contact_id, lead_id, created_at`), matching
 * `contact_clients` — hard-delete is the established convention for pure link
 * tables here. Do NOT add `deletedAt` to it (W14).
 */
async function syncContactLeadLink(
  leadId: string,
  originationContactId: string | null
): Promise<void> {
  // Remove any link that no longer matches — covers both "cleared" and
  // "changed to someone else".
  await db
    .delete(contactLeads)
    .where(
      originationContactId
        ? and(
            eq(contactLeads.leadId, leadId),
            ne(contactLeads.contactId, originationContactId)
          )
        : eq(contactLeads.leadId, leadId)
    )

  if (!originationContactId) {
    return
  }

  await db
    .insert(contactLeads)
    .values({ leadId, contactId: originationContactId })
    .onConflictDoNothing()
}

function normalizeLeadPayload(
  payload: SaveLeadInput
): {
  id?: string
  contactName: string
  status: LeadStatusValue
  originationContactId: string | null
  originationUserId: string | null
  assigneeId: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notes: string | null
} {
  return {
    id: payload.id,
    contactName: payload.contactName.trim(),
    status: payload.status ?? 'NEW_OPPORTUNITIES',
    // Enforce the mutex HERE as well as in the database, so a constraint
    // violation is never the user-facing error. The selected mode decides which
    // slot survives; the other is cleared unconditionally.
    originationContactId:
      payload.originationMode === 'external'
        ? (payload.originationContactId ?? null)
        : null,
    originationUserId:
      payload.originationMode === 'internal'
        ? (payload.originationUserId ?? null)
        : null,
    assigneeId: payload.assigneeId ?? null,
    contactEmail: normalizeEmail(payload.contactEmail),
    contactPhone: normalizeOptionalString(payload.contactPhone, 40),
    companyName: normalizeOptionalString(payload.companyName, 160),
    companyWebsite: normalizeOptionalString(payload.companyWebsite, 255),
    notes: (payload.notes ?? '').trim() || null,
  }
}

function normalizeOptionalString(
  value: string | null | undefined,
  maxLength: number
): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.length) {
    return null
  }

  const truncated = trimmed.slice(0, maxLength)
  return truncated
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.length) {
    return null
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(trimmed)) {
    throw new Error('Invalid email address.')
  }

  return trimmed
}
