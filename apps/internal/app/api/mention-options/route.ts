import { NextResponse, type NextRequest } from 'next/server'

import {
  loadLeadAssigneeOptions,
  loadTaskAssigneeOptions,
} from '@/lib/assignees/options'
import { assertCan } from '@/lib/auth/permissions'
import { authorizeRoute } from '@/lib/auth/guard'
import { ForbiddenError, NotFoundError } from '@/lib/errors/http'
import {
  ensureLeadTaskAccess,
  ensureProjectWorkAccess,
} from '@/lib/projects/access'
import { UUID_PATTERN } from '@/lib/sheets/entities'

const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status })

/**
 * GET /api/mention-options: who `@` can mention, the same people the
 * record's assignee picker offers (so only people who can open it).
 *
 * - `?projectId=<id>`: a task in that project (description, comments).
 * - `?leadTaskId=<id>`: a task on that lead.
 * - `?lead`: a lead's notes and updates (any lead, new ones too: every
 *   admin and Sales person can open leads).
 */
export async function GET(request: NextRequest) {
  const { user, denied } = await authorizeRoute('portal.sign_in')
  if (denied) return denied

  const params = request.nextUrl.searchParams
  const project = params.get('projectId')
  const leadTask = params.get('leadTaskId')
  const id = project ?? leadTask
  if (id !== null && !UUID_PATTERN.test(id)) return fail('Not found.', 404)
  if (id === null && !params.has('lead')) return fail('Not found.', 404)

  try {
    if (project) {
      await ensureProjectWorkAccess(user, project)
      return NextResponse.json({
        ok: true,
        data: await loadTaskAssigneeOptions(project),
      })
    }
    if (leadTask) {
      await ensureLeadTaskAccess(user, leadTask)
      return NextResponse.json({
        ok: true,
        data: await loadTaskAssigneeOptions(null),
      })
    }
    assertCan(user, 'leads.manage')
    return NextResponse.json({
      ok: true,
      data: await loadLeadAssigneeOptions(),
    })
  } catch (error) {
    if (error instanceof NotFoundError) return fail('Not found.', 404)
    if (error instanceof ForbiddenError) return fail('Forbidden', 403)
    console.error('Failed to load mention options', error)
    return fail('Unable to load people.', 500)
  }
}
