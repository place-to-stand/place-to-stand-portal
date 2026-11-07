/** The slice of the Stripe client this needs; tests pass a fake. */
export type StripePaymentsClient = {
  paymentIntents: {
    retrieve(id: string): Promise<{ id: string; status: string }>
    cancel(id: string): Promise<unknown>
  }
  checkout: {
    sessions: {
      retrieve(
        id: string
      ): Promise<{ id: string; status: string | null; payment_status: string }>
      expire(id: string): Promise<unknown>
    }
  }
}

/** Payment intents a client can still pay; cancelling one stops that. */
const CANCELLABLE_INTENT_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
])

/**
 * - `clear`: nothing can pay the invoice any more.
 * - `in_progress`: a payment is going through; wait for it.
 * - `paid`: Stripe already took the money; the invoice should read Paid.
 * - `unreachable`: Stripe couldn't confirm either way.
 */
export type StopPaymentsOutcome =
  'clear' | 'in_progress' | 'paid' | 'unreachable'

/** Why an invoice can't leave Sent yet, for each outcome but `clear`. */
export function stopPaymentsRefusal(
  outcome: Exclude<StopPaymentsOutcome, 'clear'>,
  action: 'voided' | 'reverted to draft' | 'archived' | 'edited'
): string {
  switch (outcome) {
    case 'paid':
      return `Stripe already took payment for this invoice, so it can’t be ${action}. It shows as Paid once Stripe confirms; if it doesn’t, check the payment in Stripe.`
    case 'in_progress':
      return `A payment for this invoice is going through, so it can’t be ${action}. Try again once it settles.`
    case 'unreachable':
      return `Stripe couldn’t confirm that no payment is open, so the invoice can’t be ${action}. Try again in a minute.`
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'resource_missing'
  )
}

/**
 * Makes sure no open Stripe payment can still pay this invoice, before it
 * leaves Sent (void, or back to draft). Cancels an open payment intent and
 * expires an open checkout session. Anything other than `clear` means the
 * caller must refuse: going ahead would take the client's money for an
 * invoice that is no longer payable.
 */
export async function stopOpenPaymentsWith(
  getClient: () => StripePaymentsClient,
  refs: {
    paymentIntentId: string | null
    checkoutSessionId: string | null
  }
): Promise<StopPaymentsOutcome> {
  if (!refs.paymentIntentId && !refs.checkoutSessionId) return 'clear'

  try {
    const stripe = getClient()

    if (refs.paymentIntentId) {
      const intent = await stripe.paymentIntents
        .retrieve(refs.paymentIntentId)
        .catch(error => {
          if (isMissing(error)) return null
          throw error
        })
      if (intent && intent.status !== 'canceled') {
        if (intent.status === 'succeeded') return 'paid'
        if (!CANCELLABLE_INTENT_STATUSES.has(intent.status)) {
          return 'in_progress'
        }
        await stripe.paymentIntents.cancel(intent.id)
      }
    }

    if (refs.checkoutSessionId) {
      const session = await stripe.checkout.sessions
        .retrieve(refs.checkoutSessionId)
        .catch(error => {
          if (isMissing(error)) return null
          throw error
        })
      if (session?.status === 'complete') {
        return session.payment_status === 'paid' ? 'paid' : 'in_progress'
      }
      if (session?.status === 'open') {
        await stripe.checkout.sessions.expire(session.id)
      }
    }
  } catch (error) {
    console.error('Failed to stop open invoice payments', error)
    return 'unreachable'
  }

  return 'clear'
}
