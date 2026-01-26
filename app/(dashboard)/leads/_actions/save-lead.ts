'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_VALUES,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { PRIORITY_TIERS, type PriorityTier } from '@/lib/leads/intelligence-types'
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
  sourceType: z.enum(LEAD_SOURCE_TYPES).optional().nullable(),
  sourceDetail: z
    .string()
    .trim()
    .max(160, 'Source info must be 160 characters or fewer')
    .optional()
    .nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  contactEmail: z.string().trim().max(160).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  companyWebsite: z.string().trim().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  priorityTier: z.enum(PRIORITY_TIERS).optional().nullable(),
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

  try {
    if (!normalized.id) {
      const rank = await resolveNextLeadRank(normalized.status)

      await db.insert(leads).values({
        contactName: normalized.contactName,
        status: normalized.status,
        sourceType: normalized.sourceType,
        sourceDetail: normalized.sourceDetail,
        assigneeId: normalized.assigneeId,
        contactEmail: normalized.contactEmail,
        contactPhone: normalized.contactPhone,
        companyName: normalized.companyName,
        companyWebsite: normalized.companyWebsite,
        notes: serializeLeadNotes(normalized.notes),
        priorityTier: normalized.priorityTier,
        rank,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
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

      if (existing.status !== normalized.status) {
        rank = await resolveNextLeadRank(normalized.status)
      }

      await db
        .update(leads)
        .set({
          contactName: normalized.contactName,
          status: normalized.status,
          sourceType: normalized.sourceType,
          sourceDetail: normalized.sourceDetail,
          assigneeId: normalized.assigneeId,
          contactEmail: normalized.contactEmail,
          contactPhone: normalized.contactPhone,
          companyName: normalized.companyName,
          companyWebsite: normalized.companyWebsite,
          notes: serializeLeadNotes(normalized.notes),
          priorityTier: normalized.priorityTier,
          rank,
          updatedAt: timestamp,
        })
        .where(eq(leads.id, normalized.id))
    }
  } catch (error) {
    console.error('Failed to save lead', error)
    return {
      success: false,
      error: 'Unable to save lead. Please try again.',
    }
  }

  revalidateLeadsPath()
  return { success: true }
}

function normalizeLeadPayload(
  payload: SaveLeadInput
): {
  id?: string
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notes: string | null
  priorityTier: PriorityTier | null
} {
  return {
    id: payload.id,
    contactName: payload.contactName.trim(),
    status: payload.status ?? 'NEW_OPPORTUNITIES',
    sourceType: payload.sourceType ?? null,
    sourceDetail: normalizeOptionalString(payload.sourceDetail, 160),
    assigneeId: payload.assigneeId ?? null,
    contactEmail: normalizeEmail(payload.contactEmail),
    contactPhone: normalizeOptionalString(payload.contactPhone, 40),
    companyName: normalizeOptionalString(payload.companyName, 160),
    companyWebsite: normalizeOptionalString(payload.companyWebsite, 255),
    notes: (payload.notes ?? '').trim() || null,
    priorityTier: payload.priorityTier ?? null,
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
