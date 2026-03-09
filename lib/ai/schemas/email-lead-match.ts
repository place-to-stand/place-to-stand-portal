import { z } from 'zod'

/**
 * Schema for AI-generated lead matches from email analysis
 */
export const leadMatchSchema = z.object({
  leadId: z.string().uuid().describe('The exact UUID of the matched lead from the provided list'),
  leadName: z.string().describe('The contact name of the matched lead'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score from 0.0 to 1.0'),
  reasoning: z
    .string()
    .max(500)
    .describe('Brief explanation of why this lead was matched'),
  matchType: z
    .enum(['EXACT_EMAIL', 'NAME', 'DOMAIN', 'CONTENT', 'CONTEXTUAL'])
    .describe('The primary reason for the match'),
})

export type LeadMatch = z.infer<typeof leadMatchSchema>
