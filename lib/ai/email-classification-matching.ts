import 'server-only'

import { generateText, Output } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import {
  EMAIL_CLASSIFY_SYSTEM_PROMPT,
  buildEmailClassifyUserPrompt,
  type EmailClassifyPromptParams,
} from './prompts/email-to-classify'
import { emailClassifyResponseSchema } from './schemas/email-classify-match'
import type { ClientMatch } from './schemas/email-client-match'
import type { ProjectMatch } from './schemas/email-project-match'

const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

export interface ClassifyEmailThreadParams {
  email: EmailClassifyPromptParams['email']
  clients: EmailClassifyPromptParams['clients']
  projects: EmailClassifyPromptParams['projects']
}

export interface ClassificationResponse {
  clientMatches: ClientMatch[]
  projectMatches: ProjectMatch[]
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Use AI to classify an email thread — matches both clients and projects in a single LLM call
 */
export async function classifyEmailThread(
  params: ClassifyEmailThreadParams
): Promise<ClassificationResponse> {
  if (params.clients.length === 0 && params.projects.length === 0) {
    return {
      clientMatches: [],
      projectMatches: [],
      usage: { promptTokens: 0, completionTokens: 0 },
    }
  }

  const userPrompt = buildEmailClassifyUserPrompt({
    email: params.email,
    clients: params.clients,
    projects: params.projects,
  })

  const { output, usage } = await generateText({
    model,
    system: EMAIL_CLASSIFY_SYSTEM_PROMPT,
    prompt: userPrompt,
    output: Output.object({ schema: emailClassifyResponseSchema }),
  })

  const filteredClientMatches = output!.clientMatches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  const filteredProjectMatches = output!.projectMatches
    .filter(m => m.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    clientMatches: filteredClientMatches,
    projectMatches: filteredProjectMatches,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}
