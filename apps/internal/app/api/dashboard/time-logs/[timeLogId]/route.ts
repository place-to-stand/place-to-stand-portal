import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth/session'
import { fetchAdminUsers } from '@/lib/data/users'
import { fetchProjectsWithRelationsByIds } from '@/lib/data/projects'
import { getTimeLogEntryById } from '@/lib/queries/time-logs/read'
import { buildProjectTimeLogDialogParams } from '@/lib/projects/time-log/dialog-params'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Everything the time-log dialog needs to open in edit mode, for one log.
 *
 * The hours widget lists logs in a lean shape (no author record, no linked
 * tasks, no project graph) because a dashboard list does not need any of it.
 * Editing does, so it is fetched here on demand rather than inflating every
 * list row for the rare row that gets opened.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ timeLogId: string }> }
) {
  const user = await requireUser()
  const { timeLogId } = await params

  // UUID-guard before any DB cast, matching the sheet deep-link convention.
  if (!UUID_PATTERN.test(timeLogId)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid time log id.' },
      { status: 400 }
    )
  }

  try {
    // getTimeLogEntryById runs ensureTimeLogAccess, which asserts admin and
    // 404s soft-deleted logs, so the project fetch below is already guarded.
    const entry = await getTimeLogEntryById(user, timeLogId)

    const [projects, admins] = await Promise.all([
      fetchProjectsWithRelationsByIds([entry.project_id]),
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
        entry,
        params: buildProjectTimeLogDialogParams(project, {
          tasks: project.tasks,
          currentUserId: user.id,
          admins,
        }),
      },
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Time log not found.' },
        { status: 404 }
      )
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { ok: false, error: 'You do not have permission to edit this log.' },
        { status: 403 }
      )
    }

    console.error('Failed to load time log edit context', error)
    return NextResponse.json(
      { ok: false, error: 'Unable to open that time log right now.' },
      { status: 500 }
    )
  }
}
