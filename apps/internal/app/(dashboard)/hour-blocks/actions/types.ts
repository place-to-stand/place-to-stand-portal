import type { z } from 'zod'

import {
  hourBlockSchema,
  deleteSchema,
  restoreSchema,
} from './schemas'

export type ActionResult = {
  error?: string
  /** Non-blocking notice (closed-month drift, future billing month). */
  warning?: string
  fieldErrors?: Record<string, string[]>
}

export type HourBlockInput = z.infer<typeof hourBlockSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type RestoreInput = z.infer<typeof restoreSchema>
