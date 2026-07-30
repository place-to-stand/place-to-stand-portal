import { z } from 'zod'

/**
 * The analytics / attribution / client blocks shared by both marketing intake
 * payloads. Defined once so the two routes cannot drift apart.
 *
 * On the length caps: these exist purely as an abuse guard, NOT as validation.
 * The marketing site's own proxy route is the tighter gate, and the portal must
 * never be the stricter of the two — if it is, a payload the sender happily
 * accepts gets a 400 here, and their handler logs it and moves on, losing the
 * beacon silently. Keep every cap at or above the corresponding one in the
 * marketing repo's `app/api/audit-progress/route.ts`.
 */

export const analyticsSchema = z.object({
  posthogDistinctId: z.string().trim().max(256).nullable(),
  posthogSessionId: z.string().trim().max(256).nullable(),
  posthogReplayUrl: z.string().trim().max(2048).nullable(),
})

export const attributionSchema = z.object({
  utmSource: z.string().trim().max(256).nullable(),
  utmMedium: z.string().trim().max(256).nullable(),
  utmCampaign: z.string().trim().max(256).nullable(),
  utmTerm: z.string().trim().max(256).nullable(),
  utmContent: z.string().trim().max(256).nullable(),
  gclid: z.string().trim().max(512).nullable(),
  referrer: z.string().trim().max(2048).nullable(),
  landingPath: z.string().trim().max(512).nullable(),
})

export const clientSchema = z.object({
  viewport: z.enum(['mobile', 'tablet', 'desktop']).nullable(),
  screenWidth: z.number().int().min(0).nullable(),
  timezone: z.string().trim().max(256).nullable(),
  language: z.string().trim().max(64).nullable(),
  userAgent: z.string().trim().max(1024).nullable(),
})

/** ISO 8601, accepting both `Z` and numeric offsets. */
export const isoDateTime = z.iso.datetime({ offset: true })
