import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAdmin } from '@/lib/auth/session'
import { loadPlanRevisions } from '@/lib/data/planning'
import { HttpError } from '@/lib/errors/http'

const paramsSchema = z.object({
  threadId: z.string().uuid(),
})

/** A plan thread's revisions, oldest first. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/planning/threads/[threadId]/revisions'>
) {
  const user = await getCurrentAdmin()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const revisions = await loadPlanRevisions(
      user,
      parsedParams.data.threadId
    )
    return NextResponse.json({ revisions }, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load plan revisions', error)
    return NextResponse.json(
      { error: 'Unable to load plan revisions.' },
      { status: 500 }
    )
  }
}
