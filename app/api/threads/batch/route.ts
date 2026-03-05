import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { captureServerEvent } from '@/lib/posthog/server'
import { updateThread } from '@/lib/queries/threads'

const batchSchema = z.object({
  action: z.enum(['dismiss']),
  threadIds: z.array(z.string().uuid()).min(1).max(100),
})

export async function POST(request: Request) {
  const user = await requireUser()
  assertAdmin(user)

  const body = await request.json()
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { action, threadIds } = parsed.data

  if (action === 'dismiss') {
    const results = await Promise.allSettled(
      threadIds.map(id =>
        updateThread(id, {
          classification: 'DISMISSED',
          classifiedBy: user.id,
          classifiedAt: new Date().toISOString(),
          clientId: null,
          projectId: null,
          leadId: null,
        })
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    captureServerEvent({
      distinctId: user.id,
      event: 'inbox_batch_dismissed',
      properties: {
        thread_count: threadIds.length,
        succeeded,
        failed,
      },
    }).catch(() => {}) // Fire and forget

    return NextResponse.json({
      ok: true,
      dismissed: succeeded,
      failed,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
