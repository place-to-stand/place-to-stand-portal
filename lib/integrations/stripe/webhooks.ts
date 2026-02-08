import 'server-only'

import type Stripe from 'stripe'

import { getStripeClient } from './client'

/**
 * Verify a Stripe webhook signature and construct the event object.
 * Must be called with the **raw request body** (text, not parsed JSON).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set.')
  }
  return stripe.webhooks.constructEventAsync(rawBody, signature, secret)
}
