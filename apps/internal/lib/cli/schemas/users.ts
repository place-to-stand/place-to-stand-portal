import { z } from 'zod'

import { cliListQuerySchema } from './listing'

export const cliUserListQuerySchema = cliListQuerySchema.extend({
  role: z.enum(['ADMIN', 'CLIENT']).optional(),
})
