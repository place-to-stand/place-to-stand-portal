import { streamText, stepCountIs, type ModelMessage } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth/session'
import { getRepoLinkById } from '@/lib/data/github-repos'
import { getRepoTree, resolveRepoLinkAuth } from '@/lib/github/client'
import { createPlanningTools } from '@/lib/ai/planning'
import { buildScopePlanningSystemPrompt } from '@/lib/ai/scope-planning'
import { extractFormattedText } from '@/lib/google/sow-parser'
import type { GoogleDocsDocument } from '@/lib/google/sow-parser-types'
import {
  getMessages,
  appendMessage,
  createRevision,
  updateThreadVersion,
} from '@/lib/queries/planning'
import { getSowById, getCurrentSnapshot } from '@/lib/queries/sow'

const gateway = createGateway()

const requestSchema = z.object({
  threadId: z.string().uuid(),
  repoLinkId: z.string().uuid(),
  sowId: z.string().uuid(),
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
    sowId,
    feedback,
    model,
    currentVersion,
  } = parsed.data

  // Load SOW and snapshot content
  const sow = await getSowById(sowId)
  if (!sow) {
    return new Response(JSON.stringify({ error: 'SOW not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const snapshot = await getCurrentSnapshot(sowId)
  if (!snapshot?.textContent) {
    return new Response(
      JSON.stringify({ error: 'No snapshot content available. Sync the SOW first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Prefer formatting-aware text (preserves strikethrough, bold, etc.)
  // Fall back to plain textContent for old snapshots without rawContent
  let sowText = snapshot.textContent
  if (snapshot.rawContent) {
    try {
      sowText = extractFormattedText(
        snapshot.rawContent as unknown as GoogleDocsDocument
      )
    } catch {
      // Fall back to textContent
    }
  }

  // Load repo link for GitHub API access
  const repoLink = await getRepoLinkById(repoLinkId)
  if (!repoLink) {
    return new Response(JSON.stringify({ error: 'Repository not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Resolve auth once for all GitHub API calls
  const repoAuth = await resolveRepoLinkAuth(user.id, repoLink)

  // Fetch repo tree for system prompt context
  let repoTreePaths: string[] = []
  try {
    const tree = await getRepoTree(
      user.id,
      repoLink.repoOwner,
      repoLink.repoName,
      repoLink.defaultBranch,
      repoAuth
    )
    repoTreePaths = tree.entries
      .filter(e => e.type === 'blob')
      .map(e => e.path)
      .filter(p => {
        const excluded = [
          'node_modules/',
          '.git/',
          'dist/',
          '.next/',
          '.vercel/',
          'coverage/',
        ]
        return !excluded.some(ex => p.startsWith(ex))
      })
      .slice(0, 500)
  } catch {
    // Non-fatal — proceed without tree
  }

  // Use the SOW document title or fall back to generic project name
  const projectName = sow.googleDocTitle ?? 'Project'

  const systemPrompt = buildScopePlanningSystemPrompt(
    sowText,
    projectName,
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

  // Ensure conversation ends with a user message
  if (feedback) {
    conversationMessages.push({ role: 'user', content: feedback })
    await appendMessage(threadId, 'user', feedback)
  } else if (conversationMessages.length === 0) {
    const initialPrompt =
      'Explore the repository to understand its structure, patterns, and relevant code, then generate the phased execution plan based on the SOW.'
    conversationMessages.push({ role: 'user', content: initialPrompt })
    await appendMessage(threadId, 'user', initialPrompt)
  } else if (
    conversationMessages[conversationMessages.length - 1].role !== 'user'
  ) {
    const continuePrompt = 'Continue generating the plan.'
    conversationMessages.push({ role: 'user', content: continuePrompt })
    await appendMessage(threadId, 'user', continuePrompt)
  }

  // Create planning tools for repo access
  const tools = createPlanningTools(
    user.id,
    repoLink.repoOwner,
    repoLink.repoName,
    repoAuth
  )

  const nextVersion = currentVersion + 1

  // Haiku doesn't support extended thinking
  const supportsThinking = !model.includes('haiku')

  const result = streamText({
    model: gateway(`anthropic/${model}`),
    system: systemPrompt,
    messages: conversationMessages,
    tools,
    stopWhen: stepCountIs(30),
    providerOptions: supportsThinking
      ? {
          anthropic: {
            thinking: { type: 'enabled', budgetTokens: 32000 },
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
