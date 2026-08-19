import { z } from 'zod'

/** Shared shape for the simple list endpoints: optional search, capped limit. */
export const cliListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const cliProjectScopedQuerySchema = cliListQuerySchema.extend({
  project: z.string().trim().min(1, 'project is required.'),
})
