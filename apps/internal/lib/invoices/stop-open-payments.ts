import 'server-only'

import { getStripe } from '@/lib/stripe/client'

import {
  stopOpenPaymentsWith,
  type StopPaymentsOutcome,
} from './stop-open-payments-core'

export {
  stopPaymentsRefusal,
  type StopPaymentsOutcome,
} from './stop-open-payments-core'

/**
 * Makes sure no open Stripe payment can still pay this invoice, before it
 * leaves Sent (void, or back to draft). See `stopOpenPaymentsWith`.
 */
export function stopOpenInvoicePayments(refs: {
  paymentIntentId: string | null
  checkoutSessionId: string | null
}): Promise<StopPaymentsOutcome> {
  return stopOpenPaymentsWith(getStripe, refs)
}
