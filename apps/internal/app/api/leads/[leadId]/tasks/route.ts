import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/session'
import { listTasksForLead } from '@/lib/queries/tasks/basic'

/**
 * GET /api/leads/[leadId]/tasks
 *
 * Fetches all tasks linked to a specific lead.
 * Admin-only endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const user = await requireRole('ADMIN')
  const { leadId } = await params

  try {
    const tasks = await listTasksForLead(user, leadId)

    return NextResponse.json({
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueOn: task.dueOn,
        createdAt: task.createdAt,
      })),
    })
  } catch (error) {
    console.error('Failed to fetch lead tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}
