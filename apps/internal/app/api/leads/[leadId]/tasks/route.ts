import { NextResponse } from 'next/server'

import { inArray } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import { listLeadTasksWithRelations } from '@/lib/queries/tasks/relations'

/**
 * GET /api/leads/[leadId]/tasks
 *
 * Tasks linked to a lead, in the same hydrated shape the project board's
 * cards consume, plus the assignee identities the cards render (the board
 * gets those from its own admins payload; this sheet section is self-fed).
 * Admin-only endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { leadId } = await params

  try {
    const rawTasks = await listLeadTasksWithRelations(user, leadId)
    const tasks = rawTasks.map(normalizeRawTask)

    const assigneeIds = [
      ...new Set(
        tasks.flatMap(task =>
          task.assignees.map(assignee => assignee.user_id)
        )
      ),
    ]

    const assigneeRows = assigneeIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(inArray(users.id, assigneeIds))
      : []

    const assignees = Object.fromEntries(
      assigneeRows.map(row => [
        row.id,
        {
          id: row.id,
          name: row.fullName ?? row.email ?? 'Unknown',
          avatarUrl: row.avatarUrl,
        },
      ])
    )

    return NextResponse.json({ tasks, assignees })
  } catch (error) {
    console.error('Failed to fetch lead tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}
