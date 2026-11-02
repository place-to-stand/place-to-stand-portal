import { NextResponse } from 'next/server'

import { getCurrentAdmin } from '@/lib/auth/session'
import { fetchProjectsWithRelationsByIds } from '@/lib/data/projects'
import { fetchAdminUsers } from '@/lib/data/users'
import { buildProjectTimeLogDialogParams } from '@/lib/projects/time-log/dialog-params'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Everything the time-log dialog needs to log new time on one project:
 * the create-mode twin of `GET /api/dashboard/time-logs/[timeLogId]`, for
 * pages that pick the project first (the Time logs page's Log time button).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/projects/[projectId]/time-log-context'>
) {
  const user = await getCurrentAdmin()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { projectId } = await params

  if (!UUID_PATTERN.test(projectId)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid project id.' },
      { status: 400 }
    )
  }

  try {
    // Live projects only: archived ones are filtered out by the base fetch.
    const [projects, admins] = await Promise.all([
      fetchProjectsWithRelationsByIds([projectId]),
      fetchAdminUsers(),
    ])
    const project = projects[0]

    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Project not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        params: buildProjectTimeLogDialogParams(project, {
          tasks: project.tasks,
          currentUserId: user.id,
          admins,
        }),
      },
    })
  } catch (error) {
    console.error('Failed to load time log context', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to open that project right now.' },
      { status: 500 }
    )
  }
}
