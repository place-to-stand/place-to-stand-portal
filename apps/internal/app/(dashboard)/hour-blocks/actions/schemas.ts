import { z } from 'zod'

import { HOUR_BLOCK_NOTES_MAX_LENGTH } from '@/lib/hour-blocks/hour-block-form'
import {
  isQuarterHours,
  QUARTER_HOURS_MESSAGE,
} from '@/lib/time-logs/quarter-hours'

export const hourBlockSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid('Select a client'),
  hoursPurchased: z
    .number()
    .positive('Hours purchased must be greater than zero')
    .max(999_999, 'Hours purchased is too large.')
    .refine(isQuarterHours, QUARTER_HOURS_MESSAGE),
  notes: z
    .string()
    .trim()
    .max(
      HOUR_BLOCK_NOTES_MAX_LENGTH,
      `Notes must be ${HOUR_BLOCK_NOTES_MAX_LENGTH} characters or fewer.`
    )
    .optional()
    .nullable(),
  /**
   * Edit: the block's `updated_at` when the sheet loaded it. The save is
   * refused if someone saved the block since.
   */
  expectedUpdatedAt: z.string().max(64).optional(),
})

export const deleteSchema = z.object({ id: z.string().uuid() })
export const restoreSchema = z.object({ id: z.string().uuid() })
