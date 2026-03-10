import type { z } from 'zod'

import type {
  invoiceSchema,
  deleteSchema,
  restoreSchema,
  destroySchema,
  sendSchema,
  voidSchema,
} from './schemas'

export type ActionResult = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type SendResult = {
  error?: string
  invoiceNumber?: string
}

export type InvoiceInput = z.infer<typeof invoiceSchema>
export type DeleteInput = z.infer<typeof deleteSchema>
export type RestoreInput = z.infer<typeof restoreSchema>
export type DestroyInput = z.infer<typeof destroySchema>
export type SendInput = z.infer<typeof sendSchema>
export type VoidInput = z.infer<typeof voidSchema>
