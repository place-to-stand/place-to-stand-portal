import { NextResponse } from 'next/server'

import { loadTaskAssigneeOptions } from '@/lib/assignees/options'
import { authorizeRoute } from '@/lib/auth/guard'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import { ensureTaskWorkAccess } from '@/lib/projects/access'
import { UUID_PATTERN } from '@/lib/sheets/entities'

/**
 * GET /api/tasks/[taskId]/assignee-options: who a task's "Set assignee"
 * offers, by the rule a save checks (admins, plus staff who can work the
 * task's project or lead).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/tasks/[taskId]/assignee-options'>
) {
  const { user, denied } = await authorizeRoute('projects.view_member')
  if (denied) return denied
  const { taskId } = await params

  if (!UUID_PATTERN.test(taskId)) {
    return NextResponse.json(
      { ok: false, error: 'Task not found.' },
      { status: 404 }
    )
  }

  try {
    const projectId = await ensureTaskWorkAccess(user, taskId)
    return NextResponse.json({
      ok: true,
      data: await loadTaskAssigneeOptions(projectId),
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Task not found.' },
        { status: 404 }
      )
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Failed to load task assignee options', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to load people.' },
      { status: 500 }
    )
  }
}
