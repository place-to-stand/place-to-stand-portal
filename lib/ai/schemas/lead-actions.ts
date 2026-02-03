import { z } from 'zod'

export const leadActionTypeSchema = z.enum([
  'FOLLOW_UP',       // Follow up with lead (creates task)
  'REPLY',           // Draft a reply to lead
  'SCHEDULE_CALL',   // Schedule a call (creates task)
  'SEND_PROPOSAL',   // Send a proposal
  'ADVANCE_STATUS',  // Recommend status change
])

export const suggestedActionSchema = z.object({
  actionType: leadActionTypeSchema,
  priority: z.enum(['high', 'medium', 'low']).describe('Urgency of this action'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score from 0-1'),
  title: z.string().describe('Short action title'),
  reasoning: z.string().max(500).describe('Why this action is recommended'),
  suggestedContent: z
    .object({
      body: z.string().optional().describe('Draft message body for REPLY actions'),
      suggestedStatus: z.string().optional().describe('Recommended status for ADVANCE_STATUS'),
      dueDate: z.string().optional().describe('Suggested due date for time-sensitive actions'),
    })
    .optional()
    .describe('Type-specific content for the action'),
})

export const leadActionsResultSchema = z.object({
  actions: z
    .array(suggestedActionSchema)
    .max(5)
    .describe('Prioritized list of suggested actions'),
  summary: z
    .string()
    .max(500)
    .describe('Brief summary of the lead situation'),
  shouldFollowUp: z
    .boolean()
    .describe('Whether immediate follow-up is recommended'),
})

export type LeadActionType = z.infer<typeof leadActionTypeSchema>
export type SuggestedAction = z.infer<typeof suggestedActionSchema>
export type LeadActionsResult = z.infer<typeof leadActionsResultSchema>
