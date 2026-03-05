import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { captureServerEvent } from '@/lib/posthog/server'
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
  leadId: z.string().uuid().nullable().optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'ARCHIVED']).optional(),
  classification: z.enum(['UNCLASSIFIED', 'CLASSIFIED', 'DISMISSED']).optional(),
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
  const { clientId, projectId, leadId, status, classification } = bodyParsed.data

  if (clientId !== undefined) {
    updates.clientId = clientId
  }
  if (projectId !== undefined) {
    updates.projectId = projectId
  }
  if (leadId !== undefined) {
    updates.leadId = leadId
  }
  if (status !== undefined) {
    updates.status = status
  }

  // Explicit classification from client
  if (classification !== undefined) {
    updates.classification = classification
    if (classification === 'DISMISSED') {
      // Dismiss clears all links
      updates.clientId = null
      updates.projectId = null
      updates.leadId = null
      updates.classifiedBy = user.id
      updates.classifiedAt = new Date().toISOString()
    } else if (classification === 'UNCLASSIFIED') {
      updates.classifiedBy = null
      updates.classifiedAt = null
    } else {
      updates.classifiedBy = user.id
      updates.classifiedAt = new Date().toISOString()
    }
  }

  // Auto-classify on link: if any link is being set to non-null, classify
  if (classification === undefined) {
    const hasNewLink =
      (clientId !== undefined && clientId !== null) ||
      (projectId !== undefined && projectId !== null) ||
      (leadId !== undefined && leadId !== null)

    if (hasNewLink) {
      updates.classification = 'CLASSIFIED'
      updates.classifiedBy = user.id
      updates.classifiedAt = new Date().toISOString()
    } else {
      // Check if after applying updates, all links are null → revert to UNCLASSIFIED
      const finalClientId = clientId !== undefined ? clientId : thread.clientId
      const finalProjectId = projectId !== undefined ? projectId : thread.projectId
      const finalLeadId = leadId !== undefined ? leadId : thread.leadId

      if (!finalClientId && !finalProjectId && !finalLeadId && thread.classification === 'CLASSIFIED') {
        updates.classification = 'UNCLASSIFIED'
        updates.classifiedBy = null
        updates.classifiedAt = null
      }
    }
  }

  // Update lead's lastContactAt when linking to a lead
  if (updates.leadId && updates.leadId !== thread.leadId && thread.lastMessageAt) {
    await db
      .update(leads)
      .set({ lastContactAt: thread.lastMessageAt })
      .where(eq(leads.id, updates.leadId))
  }

  const updated = await updateThread(threadId, updates)

  // Track classification changes
  if (updates.classification && updates.classification !== thread.classification) {
    captureServerEvent({
      distinctId: user.id,
      event: 'inbox_thread_classified',
      properties: {
        thread_id: threadId,
        from_classification: thread.classification,
        to_classification: updates.classification,
        has_client: !!updated.clientId,
        has_project: !!updated.projectId,
        has_lead: !!updated.leadId,
      },
    }).catch(() => {}) // Fire and forget
  }

  return NextResponse.json({ ok: true, thread: updated })
}
