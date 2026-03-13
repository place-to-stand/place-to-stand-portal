import { z } from 'zod'

const lineItemSchema = z.object({
  id: z.string().uuid().optional(),
  productCatalogItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'Description is required.'),
  quantity: z.number().positive('Quantity must be greater than zero.'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative.'),
  amount: z.number().min(0, 'Amount cannot be negative.'),
  createsHourBlock: z.boolean(),
  sortOrder: z.number().int(),
})

export const invoiceSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid('Select a client.'),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  taxRate: z.number().min(0, 'Tax rate cannot be negative.'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
})

export const deleteSchema = z.object({ id: z.string().uuid() })
export const restoreSchema = z.object({ id: z.string().uuid() })
export const destroySchema = z.object({ id: z.string().uuid() })
export const sendSchema = z.object({ id: z.string().uuid() })
export const unsendSchema = z.object({ id: z.string().uuid() })
export const voidSchema = z.object({ id: z.string().uuid() })
