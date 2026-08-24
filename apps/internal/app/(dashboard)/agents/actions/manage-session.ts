'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import {
  getAgentSessionById,
  updateAgentSessionTitle,
  archiveAgentSession as archiveAgentSessionQuery,
} from '@/lib/queries/agent-sessions'

const renameSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
})

const archiveSchema = z.object({
  sessionId: z.string().uuid(),
})

type ActionResult = { ok: true } | { error: string }

export async function renameAgentSession(input: { sessionId: string; title: string }): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = renameSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Title can't be empty." }
  }

  const session = await getAgentSessionById(parsed.data.sessionId)
  if (!session) {
    return { error: 'Session not found.' }
  }

  await updateAgentSessionTitle(parsed.data.sessionId, parsed.data.title)
  revalidatePath('/agents')

  return { ok: true }
}

export async function archiveAgentSession(input: { sessionId: string }): Promise<ActionResult> {
  await requireRole('ADMIN')

  const parsed = archiveSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const session = await getAgentSessionById(parsed.data.sessionId)
  if (!session) {
    return { error: 'Session not found.' }
  }

  await archiveAgentSessionQuery(parsed.data.sessionId)
  revalidatePath('/agents')

  return { ok: true }
}
