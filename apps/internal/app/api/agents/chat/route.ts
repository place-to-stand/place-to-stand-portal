import { after } from 'next/server'
import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { buildAgentSystemPrompt, createAgentTools, type AgentSessionScope } from '@/lib/ai/agent-tools'
import {
  getAgentSessionById,
  getSessionMessages,
  appendSessionMessage,
  insertPlaceholderAssistantMessage,
  updateMessageContent,
  setSessionTurnStatus,
  updateAgentSessionTitle,
  listClientNamesByIds,
  listProjectSummariesByIds,
} from '@/lib/queries/agent-sessions'
import {
  AGENT_MODEL_TIERS,
  DEFAULT_AGENT_TIER,
  resolveGatewayModel,
  tierSupportsThinking,
} from '@/lib/agents/models'
import { deriveSessionTitle } from '@/lib/agents/title'

// Generation is driven to completion inside after() regardless of whether
// the client that sent this request is still connected — give it enough
// budget for a multi-step tool-calling turn.
export const maxDuration = 300

const gateway = createGateway()

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  model: z.enum(AGENT_MODEL_TIERS).default(DEFAULT_AGENT_TIER),
})

const CONTENT_FLUSH_INTERVAL_MS = 400

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { sessionId, message, model: modelTier } = parsed.data

  const session = await getAgentSessionById(sessionId)
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Build conversation history from stored messages, then append the new turn.
  const storedMessages = await getSessionMessages(sessionId)
  const conversationMessages: ModelMessage[] = storedMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
  conversationMessages.push({ role: 'user', content: message })

  // First message in the session and no title yet — name it after the
  // prompt so "Untitled session" doesn't linger in the list forever.
  if (!session.title && storedMessages.length === 0) {
    await updateAgentSessionTitle(sessionId, deriveSessionTitle(message))
  }

  await appendSessionMessage(sessionId, 'user', message, { userId: user.id })

  // Pre-insert the assistant row so its id is known inside tool.execute()
  // closures (e.g. propose_task's sourceMessageId) before any text streams.
  const placeholder = await insertPlaceholderAssistantMessage(sessionId)
  await setSessionTurnStatus(sessionId, 'streaming')

  const scope = await resolveSessionScope({ clientId: session.clientId, projectId: session.projectId })

  const tools = createAgentTools(user, {
    sessionId,
    assistantMessageId: placeholder.id,
    scope: { clientId: session.clientId, projectId: session.projectId },
  })

  const supportsThinking = tierSupportsThinking(modelTier)

  // Accumulated across onChunk callbacks and throttle-flushed to the DB so
  // pollers see progressive content without a DB write per token.
  let accumulatedText = ''
  let lastFlushAt = 0

  const result = streamText({
    model: gateway(resolveGatewayModel(modelTier)),
    system: buildAgentSystemPrompt(scope),
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(15),
    providerOptions: supportsThinking
      ? {
          anthropic: {
            thinking: { type: 'enabled', budgetTokens: 16000 },
          } satisfies AnthropicLanguageModelOptions,
        }
      : undefined,
    onChunk: async ({ chunk }) => {
      if (chunk.type !== 'text-delta') return
      accumulatedText += chunk.text
      const now = Date.now()
      if (now - lastFlushAt >= CONTENT_FLUSH_INTERVAL_MS) {
        lastFlushAt = now
        await updateMessageContent(placeholder.id, accumulatedText)
      }
    },
    onFinish: async ({ text }) => {
      await updateMessageContent(placeholder.id, text || '(no response)', { status: 'complete' })
      await setSessionTurnStatus(sessionId, 'idle')
    },
    onError: async ({ error }) => {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed'
      await updateMessageContent(placeholder.id, accumulatedText || `(error: ${errorMessage})`, {
        status: 'error',
      })
      await setSessionTurnStatus(sessionId, 'error')
    },
  })

  // Drive the stream to completion independent of whether the HTTP client
  // below stays connected — without this, backpressure from an unread
  // stream can stall generation once the platform notices nobody's reading.
  after(async () => {
    try {
      await result.consumeStream()
    } catch {
      // onError above already persisted the failure state.
    }
  })

  return Response.json({ ok: true, messageId: placeholder.id }, { status: 202 })
}

async function resolveSessionScope(session: {
  clientId: string | null
  projectId: string | null
}): Promise<AgentSessionScope> {
  if (session.projectId) {
    const projectSummaries = await listProjectSummariesByIds([session.projectId])
    const project = projectSummaries.get(session.projectId)
    if (!project) {
      return { clientId: null, projectId: session.projectId }
    }
    const clientNames = project.clientId ? await listClientNamesByIds([project.clientId]) : null
    return {
      clientId: project.clientId,
      projectId: session.projectId,
      projectName: project.name,
      clientName: project.clientId ? clientNames?.get(project.clientId) ?? null : null,
    }
  }

  if (session.clientId) {
    const clientNames = await listClientNamesByIds([session.clientId])
    return {
      clientId: session.clientId,
      projectId: null,
      clientName: clientNames.get(session.clientId) ?? null,
    }
  }

  return { clientId: null, projectId: null }
}
