import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { HttpError } from '@/lib/errors/http'
import { listTaskTimeLogs } from '@/lib/queries/time-logs'

const paramsSchema = z.object({
  taskId: z.string().uuid(),
})

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await context.params)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const result = await listTaskTimeLogs(user, parsedParams.data.taskId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      )
    }

    console.error('Failed to load task time logs', error)
    return NextResponse.json(
      { error: 'Unable to load time logs.' },
      { status: 500 },
    )
  }
}
