import { z } from 'zod'

export const emailDraftSchema = z.object({
  subject: z
    .string()
    .describe('A professional, specific email subject line. Not generic — reference the actual topic or context.'),
  body: z
    .string()
    .describe(
      'The full email body in plain text. Personalized to the relationship context. Match the tone and structure of the template. Do not include a greeting or sign-off — those will be added separately.'
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in the draft quality based on available context (0-1)'),
  notes: z
    .string()
    .optional()
    .describe('Any caveats about the draft for the user to review, e.g. assumptions made due to limited context'),
})

export type EmailDraft = z.infer<typeof emailDraftSchema>
