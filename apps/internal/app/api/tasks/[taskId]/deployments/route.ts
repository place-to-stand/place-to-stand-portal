import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAdmin } from '@/lib/auth/session'
import { loadTaskDeployments } from '@/lib/data/planning'
import { HttpError } from '@/lib/errors/http'

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

/** The task's plan deployments, newest first. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/tasks/[taskId]/deployments'>
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
    const deployments = await loadTaskDeployments(
      user,
      parsedParams.data.taskId
    )
    return NextResponse.json({ deployments }, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Failed to load task deployments', error)
    return NextResponse.json(
      { error: 'Unable to load deployments.' },
      { status: 500 }
    )
  }
}
