import 'server-only'

import Stripe from 'stripe'

// Pin the API version explicitly so SDK bumps don't silently change
// runtime behavior. Must match the version configured on the Stripe
// Dashboard webhook endpoint.
const STRIPE_API_VERSION = '2026-03-25.dahlia' as const

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    })
  }
  return _stripe
}
