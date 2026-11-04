import { z } from 'zod'

import { statusSchema } from '@/lib/tasks/schemas'

import { cliListQuerySchema } from './listing'

/**
 * `baseTaskSchema` types `dueOn` as a bare string, so a malformed date reaches
 * Postgres and comes back as a raw driver error. Constrain it here rather than
 * in the shared schema, which would change browser behaviour too.
 */
const dueOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueOn must be an ISO date (YYYY-MM-DD).')
  .describe('Due date, YYYY-MM-DD.')

const titleSchema = z.string().trim().min(1, 'title is required.').max(500)

/** A project UUID or slug — resolved server-side, since agents know slugs. */
const projectRefSchema = z
  .string()
  .trim()
  .min(1, 'project is required.')
  .describe('Project slug or UUID.')

/** A user UUID or email address — resolved server-side, same reasoning. */
// A task has one assignee. Still a list for compatibility: only the first
// entry is kept (more than one is deprecated).
const assigneeRefSchema = z
  .array(z.string().trim().min(1))
  .describe(
    'The assignee, as a one-item list with a user email or UUID ([] unassigns). A task has one assignee: only the first entry is kept; passing more is deprecated.'
  )

const descriptionSchema = z
  .string()
  .describe(
    'Plain text or minimal markdown: paragraphs, - bullets, 1. lists, **bold**, *italic*, `code`, [links](https://…).'
  )

const leadRefSchema = z
  .string()
  .uuid()
  .describe(
    'Lead UUID. A task is on a project or a lead, never both: setting one clears the other.'
  )

/** A task is on a project or a lead: exactly one of the two. */
export const cliCreateTaskFields = {
  title: titleSchema,
  project: projectRefSchema.optional(),
  description: descriptionSchema.nullish(),
  status: statusSchema.default('ON_DECK'),
  dueOn: dueOnSchema.nullish(),
  assigneeIds: assigneeRefSchema.default([]),
  leadId: leadRefSchema.nullish(),
}

export const cliCreateTaskSchema = z
  .object(cliCreateTaskFields)
  .refine(payload => !payload.project !== !payload.leadId, {
    message: 'Give a project or a leadId, not both.',
    path: ['project'],
  })

/**
 * Every field optional: an omitted key keeps its current value, while an
 * explicit `null` clears it. Zod's `.optional()` vs `.nullable()` split is
 * what carries that distinction through to the merge.
 */
export const cliUpdateTaskFields = {
  title: titleSchema.optional(),
  project: projectRefSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  status: statusSchema.optional(),
  dueOn: dueOnSchema.nullable().optional(),
  assigneeIds: assigneeRefSchema.optional(),
  leadId: leadRefSchema.nullable().optional(),
}

export const cliUpdateTaskSchema = z
  .object(cliUpdateTaskFields)
  .refine(payload => Object.keys(payload).length > 0, {
    message: 'Provide at least one field to update.',
  })
  .refine(payload => !(payload.project && payload.leadId), {
    message: 'Give a project or a leadId, not both.',
    path: ['project'],
  })
export const cliCreateCommentFields = {
  body: descriptionSchema
    .trim()
    .min(1, 'body is required.')
    .max(10_000, 'body exceeds the maximum length.'),
}

export const cliCreateCommentSchema = z.object(cliCreateCommentFields)

export const cliTaskListQuerySchema = cliListQuerySchema
  .omit({ search: true })
  .extend({
    project: projectRefSchema.optional(),
    lead: z.uuid().optional(),
    status: statusSchema.optional(),
    // Email or UUID, as on MCP list_tasks and CLI leads.
    assignee: z.string().trim().min(1).optional(),
  })
