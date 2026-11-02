import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAdmin } from '@/lib/auth/session'
import { loadPlanningSession } from '@/lib/data/planning'
import { HttpError } from '@/lib/errors/http'

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

/**
 * The task's planning session and threads, or `{ session: null }` when
 * planning hasn't started. Read-only: the session is created by the first
 * explicit planning action, never by opening the panel.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/tasks/[taskId]/planning'>
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
    const session = await loadPlanningSession(user, parsedParams.data.taskId)
    return NextResponse.json({ session }, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load planning session', error)
    return NextResponse.json(
      { error: 'Unable to load planning.' },
      { status: 500 }
    )
  }
}
