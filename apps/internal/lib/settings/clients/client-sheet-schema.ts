import { z } from 'zod'

import {
  CLIENT_BILLING_TYPE_VALUES
} from './billing-types'

export const clientSheetFormSchema = z.object({
  /** Display only: the client is named after its company and label. */
  name: z.string().optional(),
  /** Tells apart two billing setups for one company ("Retainer"). */
  label: z.string().max(60).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and dashes only')
    .or(z.literal(''))
    .optional(),
  billingType: z.enum(CLIENT_BILLING_TYPE_VALUES),
  // Month boundary the report basis switches at when billingType changes on
  // an existing client (the saved type applies to the UI/invoices at once).
  billingEffective: z.enum(['current_month', 'next_month']),
  // Month boundary the Monthly Close switches closer/origination at when
  // either changes on an existing client (the cache columns flip at once).
  commissionEffective: z.enum(['current_month', 'next_month']),
  state: z.string().max(2).optional(),
  notes: z.string().optional(),
  /** The company this client is. */
  companyId: z.string().min(1, 'Pick or create the company this client is'),
})

export type ClientSheetFormValues = z.infer<typeof clientSheetFormSchema>
