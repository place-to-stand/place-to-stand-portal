import type { SaveConflict } from '@/lib/sheets/save-conflict/types'
import type { z } from 'zod'

import { hourBlockSchema, deleteSchema, restoreSchema } from './schemas'

export type ActionResult = {
  /** The saved hour block (save only), so its toast can link to it. */
  id?: string
  error?: string
  /** Non-blocking notice (closed-month drift, future billing month). */
  warning?: string
  fieldErrors?: Record<string, string[]>
  /** The block's version after a save; the sheet's next expected one. */
  updatedAt?: string
  /** Set when someone else saved first and nothing was written. */
  conflict?: SaveConflict
}

export type HourBlockInput = z.infer<typeof hourBlockSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type RestoreInput = z.infer<typeof restoreSchema>
