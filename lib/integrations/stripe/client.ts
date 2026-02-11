import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

/**
 * Lazy singleton Stripe SDK initialization.
 * Uses STRIPE_SECRET_KEY from environment.
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    stripeClient = new Stripe(secretKey)
  }
  return stripeClient
}
