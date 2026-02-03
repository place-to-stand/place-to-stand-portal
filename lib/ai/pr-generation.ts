import 'server-only'

import { generateText, Output } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import {
  PR_GENERATION_SYSTEM_PROMPT,
  buildPRGenerationUserPrompt,
  type PRGenerationPromptParams,
} from './prompts/email-to-pr'
import { generatedPRSchema, type GeneratedPR } from './schemas/pr-generation'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

export type GeneratePRParams = PRGenerationPromptParams

export interface PRGenerationResponse {
  result: GeneratedPR
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Generate a PR suggestion from email content using AI
 */
export async function generatePRSuggestion(
  params: GeneratePRParams
): Promise<PRGenerationResponse> {
  const userPrompt = buildPRGenerationUserPrompt(params)

  const { output, usage } = await generateText({
    model,
    system: PR_GENERATION_SYSTEM_PROMPT,
    prompt: userPrompt,
    output: Output.object({ schema: generatedPRSchema }),
  })

  return {
    result: output!,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}
