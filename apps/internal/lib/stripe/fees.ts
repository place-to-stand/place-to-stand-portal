import 'server-only'

import { getStripe } from './client'

/** Stripe's fees for one month, in dollars. */
export type StripeFeesData = {
  /** Card payments collected (balance `charge` category). */
  grossPayments: number
  paymentCount: number
  /** Per-payment processing fees (the `fee` on each payment). */
  processingFees: number
  /** Fees Stripe bills on their own line: Radar, Billing, Tax, FX… */
  otherFees: number
  /** processingFees + otherFees — the journal entry amount. */
  totalFees: number
  fetchedAt: string
}

export type StripeFeesState =
  | { status: 'not_configured' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: StripeFeesData }

// Guards a runaway loop; a month here is a handful of payments.
const MAX_TRANSACTIONS = 5000

const cents = (value: number): number => Math.round(value) / 100

/**
 * Sums Stripe's fees for a calendar month from the balance transactions.
 * Months are UTC, the same clock that dates paid invoices and their sales
 * tax, so fees land in the month their payments do.
 *
 * Read live rather than frozen with the close: fees on a past month's
 * balance transactions don't change after the fact.
 */
export async function loadStripeFees(
  year: number,
  month: number
): Promise<StripeFeesState> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'not_configured' }
  }

  const gte = Math.floor(Date.UTC(year, month - 1, 1) / 1000)
  const lt = Math.floor(Date.UTC(year, month, 1) / 1000)

  let grossCents = 0
  let paymentCount = 0
  let processingCents = 0
  let otherCents = 0
  let seen = 0

  try {
    for await (const txn of getStripe().balanceTransactions.list({
      created: { gte, lt },
      limit: 100,
    })) {
      if (++seen > MAX_TRANSACTIONS) {
        return {
          status: 'error',
          message: `More than ${MAX_TRANSACTIONS} Stripe transactions this month.`,
        }
      }
      if (txn.currency !== 'usd') continue

      // `fee` is what Stripe kept from this transaction. Negative when a
      // fee comes back, so a plain sum nets those out.
      processingCents += txn.fee

      if (txn.reporting_category === 'charge') {
        grossCents += txn.amount
        paymentCount += 1
      } else if (txn.reporting_category === 'fee') {
        // Standalone Stripe fees carry the charge in `amount` (negative).
        otherCents -= txn.amount
      }
    }
  } catch (error) {
    console.error('Stripe fees fetch failed', error)
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : undefined
    return {
      status: 'error',
      message:
        statusCode === 401 || statusCode === 403
          ? `Stripe rejected the key (${statusCode}).`
          : 'Stripe could not be reached.',
    }
  }

  return {
    status: 'ready',
    data: {
      grossPayments: cents(grossCents),
      paymentCount,
      processingFees: cents(processingCents),
      otherFees: cents(otherCents),
      totalFees: cents(processingCents + otherCents),
      fetchedAt: new Date().toISOString(),
    },
  }
}
