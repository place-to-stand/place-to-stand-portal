import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { MY_TASKS_WIDGET_PAGE_SIZE } from '@/lib/dashboard/types'
import { listAssignedTaskSummaries } from '@/lib/data/tasks'

const schema = z.object({
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

/**
 * Pages the home page's My Tasks widget. Mirrors the shape the page renders
 * with -- current user, open tasks only, every project type -- so a later page
 * continues the same ordered list instead of the board's `/api/my-tasks`
 * contract, which includes Done and honors hidden project types.
 */
export async function GET(request: Request) {
  const user = await requireUser()
  const { searchParams } = new URL(request.url)

  const parsed = schema.safeParse({
    offset: searchParams.get('offset') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request parameters.' },
      { status: 400 }
    )
  }

  try {
    const page = await listAssignedTaskSummaries({
      userId: user.id,
      offset: parsed.data.offset,
      limit: parsed.data.limit ?? MY_TASKS_WIDGET_PAGE_SIZE,
      includeCompletedStatuses: false,
    })

    return NextResponse.json({
      items: page.items,
      totalCount: page.totalCount,
    })
  } catch (error) {
    console.error('Failed to load my tasks page', error)
    return NextResponse.json(
      { error: 'Unable to load more tasks right now.' },
      { status: 500 }
    )
  }
}
