import 'server-only'

import type Stripe from 'stripe'

import { getStripeClient } from './client'

type CreatePaymentIntentInput = {
  amountInCents: number
  currency: string
  metadata?: Record<string, string>
}

/**
 * Create a new Stripe PaymentIntent.
 */
export async function createPaymentIntent({
  amountInCents,
  currency,
  metadata,
}: CreatePaymentIntentInput): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: metadata ?? {},
  })
}

/**
 * Retrieve an existing PaymentIntent by ID.
 */
export async function getPaymentIntent(
  id: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return stripe.paymentIntents.retrieve(id)
}
