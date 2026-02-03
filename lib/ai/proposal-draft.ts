import 'server-only'

import { generateText, Output } from 'ai'
import { createGateway } from '@ai-sdk/gateway'

import {
  PROPOSAL_DRAFT_SYSTEM_PROMPT,
  buildProposalDraftPrompt,
  type ProposalDraftInput,
} from './prompts/proposal-draft'
import { proposalDraftSchema, type ProposalDraft } from './schemas/proposal-draft'

// Vercel AI Gateway - uses AI_GATEWAY_API_KEY env var automatically
const gateway = createGateway()
const model = gateway('anthropic/claude-sonnet-4-20250514')

export type GenerateProposalDraftParams = ProposalDraftInput

export interface GenerateProposalDraftResponse {
  draft: ProposalDraft
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Generate a proposal draft using AI analysis of lead context.
 * Analyzes notes, meeting transcripts, and emails to create a structured proposal.
 */
export async function generateProposalDraft(
  params: GenerateProposalDraftParams
): Promise<GenerateProposalDraftResponse> {
  const userPrompt = buildProposalDraftPrompt(params)

  const { output, usage } = await generateText({
    model,
    system: PROPOSAL_DRAFT_SYSTEM_PROMPT,
    prompt: userPrompt,
    output: Output.object({ schema: proposalDraftSchema }),
  })

  return {
    draft: output!,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}
