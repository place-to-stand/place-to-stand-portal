import 'server-only'

import type Stripe from 'stripe'

import { getStripeClient } from './client'

/**
 * Create a PaymentIntent for an invoice.
 * Amount is in cents (e.g., $200.00 = 20000).
 */
export async function createPaymentIntent(params: {
  amountCents: number
  currency?: string
  invoiceId: string
  clientName?: string
  invoiceNumber?: string | null
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()

  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency ?? 'usd',
    metadata: {
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber ?? '',
      clientName: params.clientName ?? '',
    },
    automatic_payment_methods: {
      enabled: true,
    },
  })
}

/**
 * Retrieve a PaymentIntent by ID (for polling fallback).
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient()
  return stripe.paymentIntents.retrieve(paymentIntentId)
}
