import { z } from 'zod'

import {
  LEAD_SOURCE_TYPES,
  LEAD_STATUS_VALUES,
  type LeadSourceTypeValue,
  type LeadStatusValue,
} from '@/lib/leads/constants'
import { extractLeadNotes } from '@/lib/leads/notes'

export const saveLeadSchema = z.object({
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
  /** TipTap HTML, as the sheet's editor produces it. */
  notes: z.string().optional().nullable(),
})

export type SaveLeadInput = z.infer<typeof saveLeadSchema>

export type NormalizedLead = {
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
}

export type ExistingLead = {
  contactName: string
  status: LeadStatusValue
  sourceType: LeadSourceTypeValue | null
  sourceDetail: string | null
  assigneeId: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  companyWebsite: string | null
  notes: unknown
}

export type LeadFieldDiff = {
  changedFields: string[]
  before: Record<string, unknown>
  after: Record<string, unknown>
}

/**
 * Field-by-field comparison of the editable lead columns. Labels in
 * `changedFields` are the human phrases the summary joins; the `before`/`after`
 * records keep raw column values (enums and ids unresolved) for the feed.
 */
export function diffLeadFields(
  existing: ExistingLead,
  next: NormalizedLead
): LeadFieldDiff {
  const changedFields: string[] = []
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}

  const compare = (
    label: string,
    key: keyof ExistingLead,
    previous: unknown,
    current: unknown
  ) => {
    if (previous === current) {
      return
    }
    changedFields.push(label)
    before[key] = previous
    after[key] = current
  }

  compare('name', 'contactName', existing.contactName, next.contactName)
  compare('status', 'status', existing.status, next.status)
  compare('source', 'sourceType', existing.sourceType, next.sourceType)
  compare('source detail', 'sourceDetail', existing.sourceDetail, next.sourceDetail)
  compare('assignee', 'assigneeId', existing.assigneeId, next.assigneeId)
  compare('email', 'contactEmail', existing.contactEmail, next.contactEmail)
  compare('phone', 'contactPhone', existing.contactPhone, next.contactPhone)
  compare('company', 'companyName', existing.companyName, next.companyName)
  compare('website', 'companyWebsite', existing.companyWebsite, next.companyWebsite)
  compare(
    'notes',
    'notes',
    extractLeadNotes(existing.notes) || null,
    next.notes
  )

  return { changedFields, before, after }
}

/** Throws on a malformed email; every other field is trimmed and truncated. */
export function normalizeLeadPayload(payload: SaveLeadInput): NormalizedLead {
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

  return trimmed.slice(0, maxLength)
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
