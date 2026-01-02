import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import {
  EMAIL_TO_PROJECT_SYSTEM_PROMPT,
  buildEmailToProjectUserPrompt,
  type EmailToProjectPromptParams,
} from './prompts/email-to-project'
import {
  emailProjectMatchResponseSchema,
  type ProjectMatch,
} from './schemas/email-project-match'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

export interface MatchEmailToProjectsParams {
  email: {
    from: string | null
    to: string[]
    cc: string[]
    subject: string | null
    snippet: string | null
    bodyPreview?: string | null
  }
  projects: Array<{
    id: string
    name: string
    clientName: string | null
  }>
  linkedClientId?: string | null
}

export interface ProjectMatchingResponse {
  matches: ProjectMatch[]
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Use AI to match an email to potential projects
 */
export async function matchEmailToProjects(
  params: MatchEmailToProjectsParams
): Promise<ProjectMatchingResponse> {
  // If no projects to match against, return empty
  if (params.projects.length === 0) {
    return {
      matches: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  const promptParams: EmailToProjectPromptParams = {
    email: params.email,
    projects: params.projects,
    linkedClientId: params.linkedClientId,
  }

  const userPrompt = buildEmailToProjectUserPrompt(promptParams)

  const { object, usage } = await generateObject({
    model,
    system: EMAIL_TO_PROJECT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: emailProjectMatchResponseSchema,
  })

  // Filter out low confidence matches and sort by confidence
  const filteredMatches = object.matches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    matches: filteredMatches,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}

/**
 * Filter matches by minimum confidence threshold
 */
export function filterProjectMatchesByConfidence(
  matches: ProjectMatch[],
  minConfidence: number = 0.5
): ProjectMatch[] {
  return matches.filter(m => m.confidence >= minConfidence)
}
