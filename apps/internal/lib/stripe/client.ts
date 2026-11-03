import 'server-only'

import Stripe from 'stripe'

import { serverEnv } from '@/lib/env.server'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = serverEnv.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, { typescript: true })
  }
  return _stripe
}
