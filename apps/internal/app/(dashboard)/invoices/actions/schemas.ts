import { z } from 'zod'

import {
  isQuarterHours,
  QUARTER_HOURS_MESSAGE,
} from '@/lib/time-logs/quarter-hours'

const lineItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    productCatalogItemId: z.string().uuid().optional().nullable(),
    description: z.string().min(1, 'Description is required.'),
    // Stored at 2 decimals. The line amount and the invoice totals are worked
    // out on the server from these (save-invoice.ts), never taken from the form.
    quantity: z
      .number()
      .positive('Quantity must be greater than zero.')
      .max(999_999, 'Quantity is too large.'),
    unitPrice: z
      .number()
      .min(0, 'Unit price cannot be negative.')
      .max(9_999_999_999, 'Unit price is too large.'),
    createsHourBlock: z.boolean(),
    sortOrder: z.number().int(),
  })
  // A paid hour-block line becomes a block, which counts in quarter hours
  // (chk_invoice_line_items_hour_block_quarters).
  .refine(line => !line.createsHourBlock || isQuarterHours(line.quantity), {
    message: QUARTER_HOURS_MESSAGE,
    path: ['quantity'],
  })

export const invoiceSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid('Select a client.'),
  notes: z.string().optional().nullable(),
  /** A decimal: 0.0825 is 8.25%. */
  taxRate: z
    .number()
    .min(0, 'Tax rate cannot be negative.')
    .max(1, 'Tax rate must be a decimal, at most 1.'),
  lineItems: z
    .array(lineItemSchema)
    .min(1, 'At least one line item is required.'),
})

export const deleteSchema = z.object({ id: z.string().uuid() })
export const restoreSchema = z.object({ id: z.string().uuid() })
export const sendSchema = z.object({ id: z.string().uuid() })
export const unsendSchema = z.object({ id: z.string().uuid() })
export const voidSchema = z.object({ id: z.string().uuid() })
