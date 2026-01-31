import 'server-only'

import { generateObject } from 'ai'
import { createGateway } from '@ai-sdk/gateway'

import {
  EMAIL_DRAFT_SYSTEM_PROMPT,
  buildEmailDraftPrompt,
  type EmailDraftInput,
} from './prompts/email-draft'
import { emailDraftSchema, type EmailDraft } from './schemas/email-draft'

const gateway = createGateway()
const model = gateway('anthropic/claude-sonnet-4-20250514')

export type GenerateEmailDraftParams = EmailDraftInput

export interface GenerateEmailDraftResponse {
  draft: EmailDraft
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

/**
 * Generate a personalized email draft using AI.
 *
 * Takes a template (intent/structure) and full relationship context
 * (emails, transcripts, notes) to produce a specific, human-sounding email.
 */
export async function generateEmailDraft(
  params: GenerateEmailDraftParams
): Promise<GenerateEmailDraftResponse> {
  const userPrompt = buildEmailDraftPrompt(params)

  const { object, usage } = await generateObject({
    model,
    system: EMAIL_DRAFT_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: emailDraftSchema,
  })

  return {
    draft: object,
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
    },
  }
}
