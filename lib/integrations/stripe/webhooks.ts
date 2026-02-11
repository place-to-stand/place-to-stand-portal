import 'server-only'

import type Stripe from 'stripe'

import { getStripeClient } from './client'

/**
 * Verify a Stripe webhook signature and return the parsed event.
 */
export function verifyWebhookSignature(
  body: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set')
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret)
}

/**
 * Extract payment_intent_id from various Stripe event types.
 */
export function extractPaymentIntentId(
  event: Stripe.Event
): string | null {
  const data = event.data.object as unknown as Record<string, unknown>

  // payment_intent.succeeded / payment_intent.payment_failed
  if (typeof data.id === 'string' && event.type.startsWith('payment_intent.')) {
    return data.id
  }

  // charge.refunded — has payment_intent field
  if (typeof data.payment_intent === 'string') {
    return data.payment_intent
  }

  return null
}
