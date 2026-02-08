import 'server-only'

import Stripe from 'stripe'

let client: Stripe | null = null

/**
 * Lazy singleton for the Stripe server-side client.
 * Throws if STRIPE_SECRET_KEY is not configured.
 */
export function getStripeClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not set. Stripe payments are unavailable.'
      )
    }
    client = new Stripe(key, {
      typescript: true,
    })
  }
  return client
}
