import { NextResponse } from 'next/server'

import { requireStaffUser } from '@/lib/auth/session'
import { listWorkableProjectIds } from '@/lib/projects/access'
import { listAssignedTaskSummaries } from '@/lib/data/tasks'
import {
  HIDE_PARAM,
  parseHiddenProjectTypes,
} from '@/lib/my-tasks/project-scope'

export async function GET(request: Request) {
  const user = await requireStaffUser()
  const { searchParams } = new URL(request.url)

  const limitParam = searchParams.get('limit')
  let limit: number | null | undefined

  if (limitParam === 'all') {
    limit = null
  } else if (limitParam) {
    const parsed = Number(limitParam)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = parsed
    }
  }

  try {
    const result = await listAssignedTaskSummaries({
      userId: user.id,
      // Same `?hide=personal,internal` shape as the board URL.
      hiddenProjectTypes: parseHiddenProjectTypes(searchParams.get(HIDE_PARAM)),
      projectIds: await listWorkableProjectIds(user),
      limit,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to load my tasks', error)
    return NextResponse.json(
      { error: 'Unable to load tasks at this time.' },
      { status: 500 }
    )
  }
}

