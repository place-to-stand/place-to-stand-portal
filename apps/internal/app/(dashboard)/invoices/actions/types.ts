import type { SaveConflict } from '@/lib/sheets/save-conflict/types'
import type { z } from 'zod'

import type {
  invoiceSchema,
  deleteSchema,
  restoreSchema,
  sendSchema,
  unsendSchema,
  voidSchema,
} from './schemas'

export type ActionResult = {
  /** The saved invoice (save only), so its toast can link to it. */
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
  /** The invoice's version after a save; the sheet's next expected one. */
  updatedAt?: string
  /** Set when someone else saved first and nothing was written. */
  conflict?: SaveConflict
}

export type SendResult = {
  error?: string
  invoiceNumber?: string
  /** The now-live share link's token, so the caller can copy the link. */
  shareToken?: string
}

export type InvoiceInput = z.infer<typeof invoiceSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type RestoreInput = z.infer<typeof restoreSchema>
export type SendInput = z.infer<typeof sendSchema>
export type UnsendInput = z.infer<typeof unsendSchema>
export type VoidInput = z.infer<typeof voidSchema>
