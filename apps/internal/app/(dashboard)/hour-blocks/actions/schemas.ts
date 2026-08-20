import { z } from 'zod'

import { HOUR_BLOCK_NOTES_MAX_LENGTH } from '@/lib/settings/hour-blocks/hour-block-form'

export const hourBlockSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid('Select a client'),
  hoursPurchased: z
    .number()
    .int('Hours purchased must be a whole number.')
    .positive('Hours purchased must be greater than zero'),
  invoiceId: z.string().uuid('Select a valid invoice.').optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(
      HOUR_BLOCK_NOTES_MAX_LENGTH,
      `Notes must be ${HOUR_BLOCK_NOTES_MAX_LENGTH} characters or fewer.`
    )
    .optional()
    .nullable(),
})

export const deleteSchema = z.object({ id: z.string().uuid() })
export const restoreSchema = z.object({ id: z.string().uuid() })
export const destroySchema = z.object({ id: z.string().uuid() })
