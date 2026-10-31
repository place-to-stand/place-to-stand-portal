/**
 * What a Checkout Session event means for its invoice. A completed session
 * is paid only when Stripe says so: delayed methods (ACH, bank debits)
 * complete the session with `payment_status: 'unpaid'` and settle later with
 * `checkout.session.async_payment_succeeded` (or `_failed`).
 */
export type CheckoutPaymentOutcome =
  | 'paid' // money collected: mark the invoice paid
  | 'awaiting' // completed but not settled yet: wait for the async event
  | 'failed' // the delayed payment failed: let the client pay again

export function checkoutPaymentOutcome(
  eventType: string,
  paymentStatus: string | null | undefined
): CheckoutPaymentOutcome | null {
  switch (eventType) {
    case 'checkout.session.completed':
      return paymentStatus === 'paid' ? 'paid' : 'awaiting'
    case 'checkout.session.async_payment_succeeded':
      return paymentStatus === 'paid' ? 'paid' : 'awaiting'
    case 'checkout.session.async_payment_failed':
      return 'failed'
    default:
      return null
  }
}

/**
 * True when Stripe collected at least the invoice total, in USD cents.
 */
export function coversTotal(
  totalDollars: string | number | null,
  received: { amount: number | null; currency: string | null }
): boolean {
  const totalCents = Math.round(Number(totalDollars) * 100)
  return (
    received.amount !== null &&
    received.currency?.toLowerCase() === 'usd' &&
    received.amount >= totalCents
  )
}
