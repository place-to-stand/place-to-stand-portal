import { z } from 'zod'

export const leadSignalSchema = z.object({
  type: z
    .string()
    .describe(
      'Signal type: fast_response, multiple_stakeholders, budget_mentioned, urgency_detected, competitor_mentioned, decision_maker, going_cold, technical_fit, clear_requirements, follow_up_requested'
    ),
  weight: z.number().min(0).max(1).describe('Weight contribution to overall score (0-1)'),
  details: z.string().optional().describe('Brief explanation of the signal'),
})

export const leadScoringResultSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe('Overall lead quality score from 0-100'),
  priorityTier: z
    .enum(['hot', 'warm', 'cold'])
    .describe('Priority tier: hot (70+), warm (40-69), cold (<40)'),
  signals: z
    .array(leadSignalSchema)
    .describe('Detected signals that contribute to the score'),
  reasoning: z
    .string()
    .max(500)
    .describe('Brief explanation of the scoring rationale'),
  suggestedNextAction: z
    .string()
    .optional()
    .describe('Recommended next action for this lead'),
  predictedCloseProbability: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Estimated probability of closing (0-1)'),
})

export type LeadSignal = z.infer<typeof leadSignalSchema>
export type LeadScoringResult = z.infer<typeof leadScoringResultSchema>
