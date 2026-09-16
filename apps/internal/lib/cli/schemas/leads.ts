import { z } from 'zod'

import { LEAD_SOURCE_TYPES, LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import { LEAD_UPDATE_TYPES } from '@/lib/leads/updates'

const leadStatusSchema = z.enum(LEAD_STATUS_VALUES)
const leadSourceSchema = z.enum(LEAD_SOURCE_TYPES)

const nameSchema = z.string().trim().min(1, 'name is required.').max(160)

/** A user UUID or email address — resolved server-side, like task assignees. */
const assigneeRefSchema = z.string().trim().min(1)

const optionalText = (max: number) => z.string().trim().max(max)

export const cliCreateLeadSchema = z.object({
  name: nameSchema,
  status: leadStatusSchema.default('NEW_OPPORTUNITIES'),
  source: leadSourceSchema.nullish(),
  sourceDetail: optionalText(160).nullish(),
  assignee: assigneeRefSchema.nullish(),
  email: optionalText(160).nullish(),
  phone: optionalText(40).nullish(),
  company: optionalText(160).nullish(),
  website: optionalText(255).nullish(),
  /** Plain text or minimal markdown; converted to editor HTML on the way in. */
  notes: z.string().max(20_000).nullish(),
})

/**
 * Every field optional: an omitted key keeps its current value, while an
 * explicit `null` clears it — the same contract as `cliUpdateTaskSchema`.
 */
export const cliUpdateLeadSchema = z
  .object({
    name: nameSchema.optional(),
    status: leadStatusSchema.optional(),
    source: leadSourceSchema.nullable().optional(),
    sourceDetail: optionalText(160).nullable().optional(),
    assignee: assigneeRefSchema.nullable().optional(),
    email: optionalText(160).nullable().optional(),
    phone: optionalText(40).nullable().optional(),
    company: optionalText(160).nullable().optional(),
    website: optionalText(255).nullable().optional(),
    notes: z.string().max(20_000).nullable().optional(),
  })
  .refine(payload => Object.keys(payload).length > 0, {
    message: 'Provide at least one field to update.',
  })

export const cliLeadListQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  assignee: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const cliCreateLeadUpdateSchema = z.object({
  type: z.enum(LEAD_UPDATE_TYPES),
  /** Plain text or minimal markdown; converted to editor HTML on the way in. */
  body: z.string().trim().min(1, 'body is required.').max(10_000),
  /** ISO 8601 with offset; defaults to now. */
  occurredAt: z.string().datetime({ offset: true }).nullish(),
})

export const cliLeadUpdateListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
