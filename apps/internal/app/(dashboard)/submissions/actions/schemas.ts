import { z } from 'zod'

export const submissionIdSchema = z.object({
  id: z.string().uuid(),
})

/**
 * Acknowledge carries the version the admin actually saw: if a beacon
 * advanced the row after render (D8 re-flag), the acknowledgement must not
 * apply to data they never reviewed.
 */
export const acknowledgeSubmissionSchema = z.object({
  id: z.string().uuid(),
  expectedLastActivityAt: z.string().min(1),
})
