// Run: npx tsx --test apps/internal/lib/invoices/stop-open-payments-core.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  stopOpenPaymentsWith,
  type StripePaymentsClient,
} from './stop-open-payments-core.ts'

type Fake = {
  intent?: { id: string; status: string } | 'missing' | 'down'
  session?:
    { id: string; status: string | null; payment_status: string } | 'missing'
  cancelFails?: boolean
}

function fakeStripe(fake: Fake) {
  const calls: string[] = []
  const missing = Object.assign(new Error('No such object'), {
    code: 'resource_missing',
  })
  const client: StripePaymentsClient = {
    paymentIntents: {
      async retrieve(id) {
        calls.push(`intent.retrieve ${id}`)
        if (fake.intent === 'missing') throw missing
        if (fake.intent === 'down') throw new Error('ECONNRESET')
        if (!fake.intent) throw missing
        return fake.intent
      },
      async cancel(id) {
        calls.push(`intent.cancel ${id}`)
        if (fake.cancelFails) throw new Error('cannot cancel')
        return {}
      },
    },
    checkout: {
      sessions: {
        async retrieve(id) {
          calls.push(`session.retrieve ${id}`)
          if (fake.session === 'missing' || !fake.session) throw missing
          return fake.session
        },
        async expire(id) {
          calls.push(`session.expire ${id}`)
          return {}
        },
      },
    },
  }
  return { client, calls }
}

const run = (fake: Fake, refs: Partial<Record<'pi' | 'cs', string>>) => {
  const { client, calls } = fakeStripe(fake)
  return stopOpenPaymentsWith(() => client, {
    paymentIntentId: refs.pi ?? null,
    checkoutSessionId: refs.cs ?? null,
  }).then(outcome => ({ outcome, calls }))
}

test('no Stripe ids: clear, and Stripe is never called', async () => {
  let built = false
  const outcome = await stopOpenPaymentsWith(
    () => {
      built = true
      throw new Error('STRIPE_SECRET_KEY is not set')
    },
    { paymentIntentId: null, checkoutSessionId: null }
  )
  assert.equal(outcome, 'clear')
  assert.equal(built, false)
})

test('an open intent is cancelled', async () => {
  for (const status of [
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
  ]) {
    const { outcome, calls } = await run(
      { intent: { id: 'pi_1', status } },
      { pi: 'pi_1' }
    )
    assert.equal(outcome, 'clear')
    assert.deepEqual(calls, ['intent.retrieve pi_1', 'intent.cancel pi_1'])
  }
})

test('an already cancelled or missing intent is clear', async () => {
  assert.equal(
    (await run({ intent: { id: 'pi_1', status: 'canceled' } }, { pi: 'pi_1' }))
      .outcome,
    'clear'
  )
  assert.equal(
    (await run({ intent: 'missing' }, { pi: 'pi_1' })).outcome,
    'clear'
  )
})

test('a succeeded intent reads as paid, not cancelled', async () => {
  const { outcome, calls } = await run(
    { intent: { id: 'pi_1', status: 'succeeded' } },
    { pi: 'pi_1' }
  )
  assert.equal(outcome, 'paid')
  assert.deepEqual(calls, ['intent.retrieve pi_1'])
})

test('a processing intent reads as in progress', async () => {
  for (const status of ['processing', 'requires_capture']) {
    const { outcome } = await run(
      { intent: { id: 'pi_1', status } },
      { pi: 'pi_1' }
    )
    assert.equal(outcome, 'in_progress')
  }
})

test('Stripe down or a failed cancel reads as unreachable', async () => {
  assert.equal(
    (await run({ intent: 'down' }, { pi: 'pi_1' })).outcome,
    'unreachable'
  )
  assert.equal(
    (
      await run(
        {
          intent: { id: 'pi_1', status: 'requires_payment_method' },
          cancelFails: true,
        },
        { pi: 'pi_1' }
      )
    ).outcome,
    'unreachable'
  )
})

test('a missing Stripe key reads as unreachable, not a thrown error', async () => {
  const outcome = await stopOpenPaymentsWith(
    () => {
      throw new Error('STRIPE_SECRET_KEY is not set')
    },
    { paymentIntentId: 'pi_1', checkoutSessionId: null }
  )
  assert.equal(outcome, 'unreachable')
})

test('an open checkout session is expired', async () => {
  const { outcome, calls } = await run(
    { session: { id: 'cs_1', status: 'open', payment_status: 'unpaid' } },
    { cs: 'cs_1' }
  )
  assert.equal(outcome, 'clear')
  assert.deepEqual(calls, ['session.retrieve cs_1', 'session.expire cs_1'])
})

test('a complete session is paid or in progress by its payment status', async () => {
  assert.equal(
    (
      await run(
        { session: { id: 'cs_1', status: 'complete', payment_status: 'paid' } },
        { cs: 'cs_1' }
      )
    ).outcome,
    'paid'
  )
  assert.equal(
    (
      await run(
        {
          session: { id: 'cs_1', status: 'complete', payment_status: 'unpaid' },
        },
        { cs: 'cs_1' }
      )
    ).outcome,
    'in_progress'
  )
})

test('expired or missing sessions are clear', async () => {
  assert.equal(
    (
      await run(
        {
          session: { id: 'cs_1', status: 'expired', payment_status: 'unpaid' },
        },
        { cs: 'cs_1' }
      )
    ).outcome,
    'clear'
  )
  assert.equal(
    (await run({ session: 'missing' }, { cs: 'cs_1' })).outcome,
    'clear'
  )
})

test('both ids: the intent is handled before the session', async () => {
  const { outcome, calls } = await run(
    {
      intent: { id: 'pi_1', status: 'requires_payment_method' },
      session: { id: 'cs_1', status: 'open', payment_status: 'unpaid' },
    },
    { pi: 'pi_1', cs: 'cs_1' }
  )
  assert.equal(outcome, 'clear')
  assert.deepEqual(calls, [
    'intent.retrieve pi_1',
    'intent.cancel pi_1',
    'session.retrieve cs_1',
    'session.expire cs_1',
  ])
})
