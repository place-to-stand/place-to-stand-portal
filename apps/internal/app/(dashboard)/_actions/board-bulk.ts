'use server'

import { z } from 'zod'

import { roleCan } from '@/lib/auth/capabilities'
import { requireCrmUser, requirePage } from '@/lib/auth/session'
import {
  BULK_ACTION_LIMIT,
  type BulkActionResult,
  type BulkSelectionInput,
} from '@/lib/bulk/archive-entities'
import { revalidateLeadsPath } from '@/lib/leads/revalidate'
import { setLeadAssigneeForActor } from '@/lib/leads/set-lead-assignee'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { setTaskAssigneeForActor } from '@/lib/tasks/set-task-assignee'
import { setTaskDueDateForActor } from '@/lib/tasks/set-task-due-date'
import { revalidateTaskViews } from '@/lib/tasks/revalidate-task-views'

import { runBulk, type RowOutcome } from '../_lib/run-bulk'

/** A board's picked cards: ids only, never "every match". */
const cardIdsSchema = z.object({
  kind: z.literal('ids'),
  ids: z.array(z.string().regex(UUID_PATTERN)).min(1).max(BULK_ACTION_LIMIT),
})

const assigneeSchema = z.object({
  selection: cardIdsSchema,
  assigneeId: z.uuid().nullable(),
})

const dueDateSchema = z.object({
  selection: cardIdsSchema,
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

const INVALID: BulkActionResult = {
  done: 0,
  failed: [],
  warnings: [],
  error: 'Invalid request.',
}

function assigneeOutcome(result: { ok: true } | { ok: false; error: string }) {
  return (result.ok ? {} : { error: result.error }) satisfies RowOutcome
}

/**
 * The board bulk bar's "Set assignee" for tasks (null clears it). Each card
 * goes through the card menu's own save, so a person who can't take one
 * task is refused for that task and named in the toast.
 */
// permission: projects.view_member — then each task's own work-access check (setTaskAssigneeForActor)
export async function bulkSetTaskAssignee(input: {
  selection: BulkSelectionInput
  assigneeId: string | null
}): Promise<BulkActionResult> {
  const user = await requirePage('projects.view_member')
  const parsed = assigneeSchema.safeParse(input)
  if (!parsed.success) return INVALID
  const { selection, assigneeId } = parsed.data

  const result = await runBulk([...new Set(selection.ids)], async id =>
    assigneeOutcome(
      await setTaskAssigneeForActor(user, id, assigneeId, 'ADMIN_UI')
    )
  )
  if (result.done > 0) revalidateTaskViews()
  return result
}

/** The board bulk bar's "Set due date" for tasks (null clears it). */
// permission: projects.view_member — then each task's own work-access check (setTaskDueDateForActor)
export async function bulkSetTaskDueDate(input: {
  selection: BulkSelectionInput
  dueOn: string | null
}): Promise<BulkActionResult> {
  const user = await requirePage('projects.view_member')
  const parsed = dueDateSchema.safeParse(input)
  if (!parsed.success) return INVALID
  const { selection, dueOn } = parsed.data

  const result = await runBulk([...new Set(selection.ids)], id =>
    setTaskDueDateForActor(user, id, dueOn)
  )
  if (result.done > 0) revalidateTaskViews()
  return result
}

/** The lead board bulk bar's "Set assignee" (null clears it). */
// permission: leads.manage — checked here, then each lead's own save (setLeadAssigneeForActor)
export async function bulkSetLeadAssignee(input: {
  selection: BulkSelectionInput
  assigneeId: string | null
}): Promise<BulkActionResult> {
  const user = await requireCrmUser()
  if (!roleCan(user.role, 'leads.manage')) {
    return { ...INVALID, error: 'You do not have access to do that.' }
  }
  const parsed = assigneeSchema.safeParse(input)
  if (!parsed.success) return INVALID
  const { selection, assigneeId } = parsed.data

  const result = await runBulk([...new Set(selection.ids)], async id =>
    assigneeOutcome(
      await setLeadAssigneeForActor(user, id, assigneeId, 'ADMIN_UI')
    )
  )
  if (result.done > 0) revalidateLeadsPath()
  return result
}
