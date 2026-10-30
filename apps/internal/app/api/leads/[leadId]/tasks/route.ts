import { personNameSql } from '@pts/db/names'
import { NextResponse } from 'next/server'

import { inArray } from 'drizzle-orm'

import { requireCrmUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { normalizeRawTask } from '@/lib/data/projects/normalize-task'
import { listLeadTasksWithRelations } from '@/lib/queries/tasks/relations'
import { UUID_PATTERN } from '@/lib/sheets/entities'
import { findSalesProjectId } from '@/lib/leads/sales-project'
import { listWorkableProjectIds } from '@/lib/projects/access'

/**
 * GET /api/leads/[leadId]/tasks
 *
 * Tasks linked to a lead, in the same hydrated shape the project board's
 * cards consume, plus the assignee identities the cards render (the board
 * gets those from its own admins payload; this sheet section is self-fed).
 * CRM staff; SALES get only tasks on projects they can work.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/leads/[leadId]/tasks'>
) {
  const user = await requireCrmUser()
  const { leadId } = await params

  if (!UUID_PATTERN.test(leadId)) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  try {
    const rawTasks = await listLeadTasksWithRelations(user, leadId)
    const tasks = rawTasks.map(normalizeRawTask)

    const assigneeIds = [
      ...new Set(
        tasks.flatMap(task => task.assignees.map(assignee => assignee.user_id))
      ),
    ]

    const assigneeRows = assigneeIds.length
      ? await db
          .select({
            id: users.id,
            fullName: personNameSql,
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

    // Lead tasks live in the Sales project; a SALES user only sees them as
    // a member, so the sheet can explain an empty list.
    const workable = await listWorkableProjectIds(user)
    const salesProjectId = await findSalesProjectId()
    const inSalesProject =
      workable === null ||
      (salesProjectId !== null && workable.includes(salesProjectId))

    return NextResponse.json({ tasks, assignees, inSalesProject })
  } catch (error) {
    console.error('Failed to fetch lead tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}
