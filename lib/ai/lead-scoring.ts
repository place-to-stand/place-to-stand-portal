import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'

import {
  LEAD_SCORING_SYSTEM_PROMPT,
  buildLeadScoringPrompt,
  type LeadScoringPromptParams,
} from './prompts/lead-scoring'
import {
  leadScoringResultSchema,
  type LeadScoringResult,
} from './schemas/lead-scoring'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('google/gemini-3-flash')

export type ScoreLeadParams = LeadScoringPromptParams

export interface ScoreLeadResponse {
  result: LeadScoringResult
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Score a lead using AI analysis.
 * Evaluates engagement, fit, intent, and momentum to produce an overall score.
 */
export async function scoreLeadWithAI(
  params: ScoreLeadParams
): Promise<ScoreLeadResponse> {
  const userPrompt = buildLeadScoringPrompt(params)

  const { object, usage } = await generateObject({
    model,
    system: LEAD_SCORING_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: leadScoringResultSchema,
  })

  return {
    result: object,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}

/**
 * Quickly determine if a lead needs re-scoring based on activity.
 * Returns true if significant time has passed or new activity occurred.
 */
export function shouldRescore(
  lastScoredAt: string | null,
  lastContactAt: string | null,
  thresholdDays: number = 3
): boolean {
  if (!lastScoredAt) return true

  const scoredDate = new Date(lastScoredAt)
  const now = new Date()
  const daysSinceScored = (now.getTime() - scoredDate.getTime()) / (1000 * 60 * 60 * 24)

  // Re-score if more than threshold days since last scoring
  if (daysSinceScored >= thresholdDays) return true

  // Re-score if there's been new contact since last scoring
  if (lastContactAt) {
    const contactDate = new Date(lastContactAt)
    if (contactDate > scoredDate) return true
  }

  return false
}
