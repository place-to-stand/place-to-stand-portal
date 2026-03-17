import { z } from 'zod'

/**
 * Schema for AI-generated project matches from email analysis
 */
export const projectMatchSchema = z.object({
  projectId: z.string().uuid().describe('The exact UUID of the matched project from the provided list'),
  projectName: z.string().describe('The name of the matched project'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score from 0.0 to 1.0'),
  reasoning: z
    .string()
    .max(500)
    .describe('Brief explanation of why this project was matched'),
  matchType: z
    .enum(['NAME', 'CONTENT', 'CONTEXTUAL'])
    .describe('The primary reason for the match'),
})

export const emailProjectMatchResponseSchema = z.object({
  matches: z
    .array(projectMatchSchema)
    .max(5)
    .describe('List of matched projects, sorted by confidence (highest first)'),
  noMatchReason: z
    .string()
    .max(500)
    .optional()
    .describe('If no matches found, briefly explain why'),
})

export type ProjectMatch = z.infer<typeof projectMatchSchema>
export type EmailProjectMatchResponse = z.infer<typeof emailProjectMatchResponseSchema>
