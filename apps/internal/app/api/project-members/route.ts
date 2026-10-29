import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAdmin } from '@/lib/auth/session'
import {
  listProjectMemberCandidates,
  listProjectMemberIds,
} from '@/lib/projects/members'

const querySchema = z.object({
  projectId: z.string().uuid().optional(),
})

/**
 * GET /api/project-members?projectId=<uuid>
 *
 * Feeds the project sheet's Members field: the sales users who can be added
 * and, for an existing project, who is a member now. Admin-only.
 */
export async function GET(request: Request) {
  const user = await getCurrentAdmin()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    projectId: url.searchParams.get('projectId') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const [candidates, memberIds] = await Promise.all([
      listProjectMemberCandidates(),
      parsed.data.projectId
        ? listProjectMemberIds(parsed.data.projectId)
        : Promise.resolve([]),
    ])

    return NextResponse.json({ candidates, memberIds })
  } catch (error) {
    console.error('Failed to load project members', error)
    return NextResponse.json(
      { error: 'Unable to load project members.' },
      { status: 500 }
    )
  }
}
