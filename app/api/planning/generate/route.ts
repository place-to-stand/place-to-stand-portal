import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepoLinkById } from '@/lib/data/github-repos'
import { getRepoTree } from '@/lib/github/client'
import { buildPlanningSystemPrompt, createPlanningTools } from '@/lib/ai/planning'
import {
  getMessages,
  appendMessage,
  createRevision,
  updateThreadVersion,
} from '@/lib/queries/planning'

const gateway = createGateway()

const requestSchema = z.object({
  threadId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  taskTitle: z.string().min(1),
  taskDescription: z.string().nullable(),
  feedback: z.string().optional(),
  model: z.string().default('claude-sonnet-4.6'),
  currentVersion: z.number().int().min(0),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const {
    threadId,
    repoLinkId,
    taskTitle,
    taskDescription,
    feedback,
    model,
    currentVersion,
  } = parsed.data

  // Load repo link for GitHub API access
  const repoLink = await getRepoLinkById(repoLinkId)
  if (!repoLink) {
    return new Response(JSON.stringify({ error: 'Repository not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch repo tree for system prompt context
  let repoTreePaths: string[] = []
  try {
    const tree = await getRepoTree(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      repoLink.defaultBranch,
      repoLink.oauthConnectionId
    )
    // Filter to key file types, limit depth
    repoTreePaths = tree.entries
      .filter(e => e.type === 'blob')
      .map(e => e.path)
      .filter(p => {
        // Exclude node_modules, .git, dist, etc.
        const excluded = ['node_modules/', '.git/', 'dist/', '.next/', '.vercel/', 'coverage/']
        return !excluded.some(ex => p.startsWith(ex))
      })
      .slice(0, 500) // Cap at 500 files for prompt size
  } catch {
    // Non-fatal — proceed without tree
  }

  const systemPrompt = buildPlanningSystemPrompt(
    taskTitle,
    taskDescription,
    repoTreePaths
  )

  // Build conversation history from stored messages
  const storedMessages = await getMessages(threadId)
  const conversationMessages: ModelMessage[] = storedMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  // Ensure conversation ends with a user message (required by Anthropic API)
  if (feedback) {
    conversationMessages.push({ role: 'user', content: feedback })
    await appendMessage(threadId, 'user', feedback)
  } else if (conversationMessages.length === 0) {
    const initialPrompt = 'Generate the implementation plan.'
    conversationMessages.push({ role: 'user', content: initialPrompt })
    await appendMessage(threadId, 'user', initialPrompt)
  } else if (conversationMessages[conversationMessages.length - 1].role !== 'user') {
    // Safety: conversation must end with user message to avoid prefill error
    const continuePrompt = 'Continue generating the plan.'
    conversationMessages.push({ role: 'user', content: continuePrompt })
    await appendMessage(threadId, 'user', continuePrompt)
  }

  // Create planning tools for repo access
  const tools = createPlanningTools(
    user.id,
    repoLink.repoOwner,
    repoLink.repoName,
    repoLink.oauthConnectionId
  )

  const nextVersion = currentVersion + 1

  // Haiku doesn't support extended thinking
  const supportsThinking = !model.includes('haiku')

  const result = streamText({
    model: gateway(`anthropic/${model}`),
    system: systemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(10),
    providerOptions: supportsThinking
      ? {
          anthropic: {
            thinking: { type: 'enabled', budgetTokens: 10000 },
          } satisfies AnthropicLanguageModelOptions,
        }
      : undefined,
    onFinish: async ({ text }) => {
      if (!text) return

      // Persist assistant message
      await appendMessage(threadId, 'assistant', text)

      // Save as revision
      await createRevision(threadId, nextVersion, text, feedback || undefined)

      // Update thread version
      await updateThreadVersion(threadId, nextVersion)
    },
  })

  return result.toUIMessageStreamResponse()
}
