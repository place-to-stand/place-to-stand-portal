import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { invoices } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'

import {
  stopOpenPaymentsWith,
  type StopPaymentsOutcome,
} from './stop-open-payments-core'

export {
  stopPaymentsRefusal,
  type StopPaymentsOutcome,
} from './stop-open-payments-core'

type PaymentRefs = {
  paymentIntentId: string | null
  checkoutSessionId: string | null
}

/**
 * Makes sure no open Stripe payment can still pay this invoice, before it
 * leaves Sent (void, or back to draft). See `stopOpenPaymentsWith`.
 */
export function stopOpenInvoicePayments(
  refs: PaymentRefs
): Promise<StopPaymentsOutcome> {
  return stopOpenPaymentsWith(getStripe, refs)
}

/**
 * Add to the update that follows `stopOpenInvoicePayments`: it matches only
 * while the invoice still holds the payments that were stopped, so a payment
 * the client started in between makes the update miss instead of slipping by.
 */
export function paymentRefsUnchanged(refs: PaymentRefs): SQL {
  return sql`(${invoices.stripePaymentIntentId} is not distinct from ${refs.paymentIntentId} and ${invoices.stripeCheckoutSessionId} is not distinct from ${refs.checkoutSessionId})`
}
