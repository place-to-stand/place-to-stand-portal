import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { getThreadById, updateThread } from '@/lib/queries/threads'

const threadIdSchema = z.string().uuid('Invalid thread ID format')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  const { threadId } = await params

  const parsed = threadIdSchema.safeParse(threadId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 })
  }

  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, thread })
}

const patchSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'ARCHIVED']).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const user = await requireUser()
  assertAdmin(user)

  const { threadId } = await params

  const parsed = threadIdSchema.safeParse(threadId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 })
  }

  const body = await request.json()
  const bodyParsed = patchSchema.safeParse(body)
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: bodyParsed.error.flatten() },
      { status: 400 }
    )
  }

  const thread = await getThreadById(user, threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const updates: Parameters<typeof updateThread>[1] = {}
  const { clientId, projectId, status } = bodyParsed.data

  if (clientId !== undefined) {
    updates.clientId = clientId
  }
  if (projectId !== undefined) {
    updates.projectId = projectId
  }
  if (status !== undefined) {
    updates.status = status
  }

  const updated = await updateThread(threadId, updates)

  return NextResponse.json({ ok: true, thread: updated })
}
