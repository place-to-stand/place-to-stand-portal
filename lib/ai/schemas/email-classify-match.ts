import { z } from 'zod'

import { clientMatchSchema } from './email-client-match'
import { leadMatchSchema } from './email-lead-match'
import { projectMatchSchema } from './email-project-match'

/**
 * Combined schema for unified email classification — returns client, project, and lead matches
 */
export const emailClassifyResponseSchema = z.object({
  clientMatches: z
    .array(clientMatchSchema)
    .max(5)
    .describe('List of matched clients, sorted by confidence (highest first)'),
  projectMatches: z
    .array(projectMatchSchema)
    .max(5)
    .describe('List of matched projects, sorted by confidence (highest first)'),
  leadMatches: z
    .array(leadMatchSchema)
    .max(5)
    .describe('List of matched leads, sorted by confidence (highest first)'),
  noMatchReason: z
    .string()
    .max(500)
    .optional()
    .describe('If no matches found for clients, projects, or leads, briefly explain why'),
})

export type EmailClassifyResponse = z.infer<typeof emailClassifyResponseSchema>
