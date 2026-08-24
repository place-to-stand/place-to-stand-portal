'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireUser } from '@/lib/auth/session'
import { saveTaskForActor } from '@/lib/tasks/save-task-core'
import {
  getProposedTaskById,
  resolveProposedTask,
  linkTaskToSession,
} from '@/lib/queries/agent-sessions'

const acceptSchema = z.object({
  proposalId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
})

type AcceptResult =
  | { taskId: string }
  | { error: string }

/**
 * Accept a proposed task: creates the real task via the same actor-injected
 * core every other task-creation path uses (save-task-core.ts), then records
 * the proposal as resolved and links the new task into the session.
 */
export async function acceptProposedTask(input: {
  proposalId: string
  projectId?: string
}): Promise<AcceptResult> {
  const user = await requireUser()

  const parsed = acceptSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const proposal = await getProposedTaskById(parsed.data.proposalId)
  if (!proposal) {
    return { error: 'Proposal not found.' }
  }
  if (proposal.status !== 'proposed') {
    return { error: 'Proposal has already been resolved.' }
  }

  const targetProjectId = parsed.data.projectId ?? proposal.projectId
  if (!targetProjectId) {
    return { error: 'Select a project for this task.' }
  }

  const result = await saveTaskForActor(
    user,
    {
      projectId: targetProjectId,
      title: proposal.title,
      description: proposal.description,
      status: 'ON_DECK',
      assigneeIds: [],
    },
    'AI_AGENT'
  )

  if (!result.taskId) {
    return { error: result.error ?? 'Failed to create task.' }
  }

  await resolveProposedTask(proposal.id, {
    status: 'accepted',
    resolvedBy: user.id,
    createdTaskId: result.taskId,
  })
  await linkTaskToSession({
    sessionId: proposal.sessionId,
    taskId: result.taskId,
    addedVia: 'proposal',
  })

  revalidatePath(`/agents/${proposal.sessionId}`)

  return { taskId: result.taskId }
}

const rejectSchema = z.object({
  proposalId: z.string().uuid(),
})

type RejectResult = { ok: true } | { error: string }

export async function rejectProposedTask(input: {
  proposalId: string
}): Promise<RejectResult> {
  const user = await requireUser()

  const parsed = rejectSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid payload.' }
  }

  const proposal = await getProposedTaskById(parsed.data.proposalId)
  if (!proposal) {
    return { error: 'Proposal not found.' }
  }
  if (proposal.status !== 'proposed') {
    return { error: 'Proposal has already been resolved.' }
  }

  await resolveProposedTask(proposal.id, {
    status: 'rejected',
    resolvedBy: user.id,
  })

  revalidatePath(`/agents/${proposal.sessionId}`)

  return { ok: true }
}
