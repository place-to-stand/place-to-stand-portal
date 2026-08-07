import { z } from 'zod'

/**
 * 1-indexed month (the report URL's `month` search param is 0-indexed —
 * callers convert with `urlMonth + 1`; min(1) makes a missed conversion fail
 * loudly for January instead of silently closing December).
 */
export const closePeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
})

export type ClosePeriodInput = z.infer<typeof closePeriodSchema>
