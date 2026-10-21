import { z } from 'zod'

import { LEAD_SOURCE_TYPES, LEAD_STATUS_VALUES } from '@/lib/leads/constants'
import { LEAD_UPDATE_TYPES } from '@/lib/leads/updates'

const leadStatusSchema = z.enum(LEAD_STATUS_VALUES)
const leadSourceSchema = z.enum(LEAD_SOURCE_TYPES)

const nameSchema = z.string().trim().min(1, 'name is required.').max(160)

/** A user UUID or email address — resolved server-side, like task assignees. */
const assigneeRefSchema = z
  .string()
  .trim()
  .min(1)
  .describe('Owner, as a user email or UUID.')

const optionalText = (max: number) => z.string().trim().max(max)

/** Plain text or minimal markdown; converted to editor HTML on the way in. */
const richTextSchema = (max: number) =>
  z
    .string()
    .max(max)
    .describe(
      'Plain text or minimal markdown: paragraphs, - bullets, 1. lists, **bold**, *italic*, `code`, [links](https://…).'
    )

export const cliCreateLeadFields = {
  name: nameSchema.describe('Contact name for the lead.'),
  status: leadStatusSchema.default('NEW_OPPORTUNITIES'),
  source: leadSourceSchema.nullish(),
  sourceDetail: optionalText(160)
    .describe('Who referred them, which event, etc.')
    .nullish(),
  assignee: assigneeRefSchema.nullish(),
  email: optionalText(160).nullish(),
  phone: optionalText(40).nullish(),
  company: optionalText(160).nullish(),
  website: optionalText(255).nullish(),
  notes: richTextSchema(20_000).nullish(),
}

export const cliCreateLeadSchema = z.object(cliCreateLeadFields)

/**
 * Every field optional: an omitted key keeps its current value, while an
 * explicit `null` clears it — the same contract as `cliUpdateTaskSchema`.
 */
export const cliUpdateLeadFields = {
  name: nameSchema.optional(),
  status: leadStatusSchema
    .describe('Moving the stage records it in the lead\'s stage history.')
    .optional(),
  source: leadSourceSchema.nullable().optional(),
  sourceDetail: optionalText(160).nullable().optional(),
  assignee: assigneeRefSchema.nullable().optional(),
  email: optionalText(160).nullable().optional(),
  phone: optionalText(40).nullable().optional(),
  company: optionalText(160).nullable().optional(),
  website: optionalText(255).nullable().optional(),
  notes: richTextSchema(20_000)
    .describe('Replaces the existing notes. Plain text or minimal markdown.')
    .nullable()
    .optional(),
}

export const cliUpdateLeadSchema = z
  .object(cliUpdateLeadFields)
  .refine(payload => Object.keys(payload).length > 0, {
    message: 'Provide at least one field to update.',
  })

export const cliLeadListQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  assignee: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const cliCreateLeadUpdateFields = {
  type: z.enum(LEAD_UPDATE_TYPES),
  body: richTextSchema(10_000).trim().min(1, 'body is required.'),
  /** ISO 8601 with offset; defaults to now. */
  occurredAt: z
    .string()
    .datetime({ offset: true })
    .describe('When it happened, ISO 8601 with offset. Defaults to now.')
    .nullish(),
}

export const cliCreateLeadUpdateSchema = z.object(cliCreateLeadUpdateFields)

export const cliLeadUpdateListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
