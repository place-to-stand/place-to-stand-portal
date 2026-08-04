import { z } from 'zod'

export const submissionIdSchema = z.object({
  id: z.string().uuid(),
})
