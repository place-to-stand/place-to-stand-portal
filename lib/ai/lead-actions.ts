import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'

import {
  LEAD_ACTIONS_SYSTEM_PROMPT,
  buildLeadActionsPrompt,
  type LeadActionsPromptParams,
} from './prompts/lead-actions'
import {
  leadActionsResultSchema,
  type LeadActionsResult,
} from './schemas/lead-actions'

const gateway = createGateway()
const model = gateway('anthropic/claude-sonnet')

export interface SuggestActionsParams extends LeadActionsPromptParams {}

export interface SuggestActionsResponse {
  result: LeadActionsResult
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Suggest next actions for a lead based on their current state and activity.
 * Uses AI to analyze the lead and recommend prioritized actions.
 */
export async function suggestLeadActions(
  params: SuggestActionsParams
): Promise<SuggestActionsResponse> {
  const userPrompt = buildLeadActionsPrompt(params)

  const { object, usage } = await generateObject({
    model,
    system: LEAD_ACTIONS_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: leadActionsResultSchema,
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
 * Determine if a lead needs new action suggestions.
 * Returns true if significant changes have occurred since last suggestion generation.
 */
export function shouldSuggestActions(
  lastSuggestedAt: string | null,
  lastContactAt: string | null,
  thresholdHours: number = 24
): boolean {
  if (!lastSuggestedAt) return true

  const suggestedDate = new Date(lastSuggestedAt)
  const now = new Date()
  const hoursSinceSuggested = (now.getTime() - suggestedDate.getTime()) / (1000 * 60 * 60)

  // Re-suggest if more than threshold hours since last suggestion
  if (hoursSinceSuggested >= thresholdHours) return true

  // Re-suggest if there's been new contact since last suggestion
  if (lastContactAt) {
    const contactDate = new Date(lastContactAt)
    if (contactDate > suggestedDate) return true
  }

  return false
}
