'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads, tasks, taskAssignees } from '@/lib/db/schema'
import { resolveNextTaskRank } from '@/app/(dashboard)/projects/actions/task-rank'
import { getOrCreateSalesProject } from '@/lib/leads/sales-project'

import { revalidateLeadsPath } from './utils'
import type { LeadActionResult } from './types'

const createLeadTaskSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueOn: z.string().optional().nullable(),
  assigneeIds: z.array(z.string().uuid()).optional().default([]),
})

export type CreateLeadTaskInput = z.infer<typeof createLeadTaskSchema>

export type CreateLeadTaskResult = LeadActionResult & {
  taskId?: string
  projectId?: string
}

/**
 * Create a task linked to a lead.
 * Tasks are created in the internal "Sales" project.
 */
export async function createLeadTask(
  input: CreateLeadTaskInput
): Promise<CreateLeadTaskResult> {
  const user = await requireUser()
  assertAdmin(user)

  const parsed = createLeadTaskSchema.safeParse(input)

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid task payload.',
    }
  }

  const { leadId, title, description, dueOn, assigneeIds } = parsed.data

  // Verify lead exists
  const [lead] = await db
    .select({ id: leads.id, contactName: leads.contactName })
    .from(leads)
    .where(and(eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)

  if (!lead) {
    return { success: false, error: 'Lead not found.' }
  }

  try {
    // Get the existing Sales project (created only if absent)
    const projectId = await getOrCreateSalesProject(user.id)

    // Determine rank for the new task
    const rank = await resolveNextTaskRank(projectId, 'ON_DECK')

    // Create the task with leadId
    const timestamp = new Date().toISOString()
    const [insertedTask] = await db
      .insert(tasks)
      .values({
        projectId,
        leadId,
        title,
        description: description ?? null,
        status: 'ON_DECK',
        dueOn: dueOn ?? null,
        createdBy: user.id,
        updatedBy: user.id,
        rank,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: tasks.id })

    if (!insertedTask) {
      return { success: false, error: 'Failed to create task.' }
    }

    // Sync assignees if provided
    if (assigneeIds.length > 0) {
      await db.insert(taskAssignees).values(
        assigneeIds.map(userId => ({
          taskId: insertedTask.id,
          userId,
        }))
      )
    }

    revalidateLeadsPath()

    return {
      success: true,
      taskId: insertedTask.id,
      projectId,
    }
  } catch (error) {
    console.error('Failed to create lead task:', error)
    return {
      success: false,
      error: 'Unable to create task. Please try again.',
    }
  }
}
