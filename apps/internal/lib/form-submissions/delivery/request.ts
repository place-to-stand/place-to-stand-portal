import 'server-only'

import { consumeRateLimit } from '@pts/db/rate-limit'

import { db } from '@/lib/db'

const WINDOW_SECONDS = 15 * 60
const PER_ADDRESS_LIMIT = 3

/**
 * Decides whether an intake request may ask for email, and returns the
 * timestamp to store as `delivery_requested_at` (or null to record only).
 *
 * The intake tokens and the marketing site's BotID check are the real gate.
 * This is the backstop behind them: a confirmation email goes to an address a
 * stranger typed, so one address can only trigger a few per window however the
 * request got here. Over the limit the submission is still recorded and still
 * flags unread in the portal; it just does not mail anyone.
 */
export async function resolveDeliveryRequest({
  deliver,
  email,
}: {
  deliver: boolean
  email: string | null | undefined
}): Promise<string | null> {
  if (!deliver || !email) return null

  const { allowed, count } = await consumeRateLimit(db, {
    key: `form-deliver:${email.trim().toLowerCase()}`,
    limit: PER_ADDRESS_LIMIT,
    windowSeconds: WINDOW_SECONDS,
  })

  if (!allowed) {
    console.warn('Form email delivery throttled', { email, hits: count })
    return null
  }

  return new Date().toISOString()
}
