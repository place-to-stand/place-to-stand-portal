// Run: npx tsx --test apps/internal/lib/invoices/stripe-checkout-payment.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  checkoutPaymentOutcome,
  coversTotal,
} from './stripe-checkout-payment.ts'

test('a completed checkout is paid only when Stripe says paid', () => {
  assert.equal(
    checkoutPaymentOutcome('checkout.session.completed', 'paid'),
    'paid'
  )
  assert.equal(
    checkoutPaymentOutcome('checkout.session.completed', 'unpaid'),
    'awaiting'
  )
  assert.equal(
    checkoutPaymentOutcome('checkout.session.completed', null),
    'awaiting'
  )
})

test('delayed payments settle on the async events', () => {
  assert.equal(
    checkoutPaymentOutcome('checkout.session.async_payment_succeeded', 'paid'),
    'paid'
  )
  assert.equal(
    checkoutPaymentOutcome('checkout.session.async_payment_failed', 'unpaid'),
    'failed'
  )
  assert.equal(checkoutPaymentOutcome('payment_intent.succeeded', 'paid'), null)
})

test('the payment must cover the invoice total in USD', () => {
  assert.equal(coversTotal('100.00', { amount: 10000, currency: 'usd' }), true)
  assert.equal(coversTotal('100.00', { amount: 10001, currency: 'USD' }), true)
  assert.equal(coversTotal('100.00', { amount: 9999, currency: 'usd' }), false)
  assert.equal(coversTotal('100.00', { amount: 10000, currency: 'eur' }), false)
  assert.equal(coversTotal('100.00', { amount: null, currency: 'usd' }), false)
  assert.equal(coversTotal('99.995', { amount: 10000, currency: 'usd' }), true)
})
