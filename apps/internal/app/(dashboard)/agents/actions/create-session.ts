'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth/session'
import { createAgentSession } from '@/lib/queries/agent-sessions'

const createSessionSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  repoLinkId: z.string().uuid().optional(),
})

type CreateSessionResult =
  | { sessionId: string }
  | { error: string }

export async function createSession(
  input: { clientId?: string; projectId?: string; repoLinkId?: string } = {}
): Promise<CreateSessionResult> {
  const user = await requireRole('ADMIN')

  const parsed = createSessionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const session = await createAgentSession({
    createdBy: user.id,
    clientId: parsed.data.clientId ?? null,
    projectId: parsed.data.projectId ?? null,
    repoLinkId: parsed.data.repoLinkId ?? null,
  })

  revalidatePath('/agents')

  return { sessionId: session.id }
}
