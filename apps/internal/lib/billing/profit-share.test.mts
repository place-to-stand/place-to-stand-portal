// Run: npx tsx --test apps/internal/lib/billing/profit-share.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { computeProfitShare, profitShareAppliesTo } from './profit-share.ts'

const policy = { startsOn: '2026-08-01' }

test('off when no profit share is set up', () => {
  assert.equal(profitShareAppliesTo(null, 2026, 11), false)
})

test('applies from the start month on, never before', () => {
  assert.equal(profitShareAppliesTo(policy, 2026, 7), false)
  assert.equal(profitShareAppliesTo(policy, 2026, 8), true)
  assert.equal(profitShareAppliesTo(policy, 2026, 12), true)
  assert.equal(profitShareAppliesTo(policy, 2027, 1), true)
})

const base = {
  asOfDate: '2026-08-31',
  monthComplete: true,
  accounts: [],
  fetchedAt: '2026-09-01T00:00:00.000Z',
  partners: [
    { userId: 'a', name: 'A', email: 'a@x.test', avatarUpdatedAt: null },
    { userId: 'b', name: 'B', email: 'b@x.test', avatarUpdatedAt: null },
  ],
}

test('splits what is left after payouts and the minimum, rounding down', () => {
  const share = computeProfitShare({
    ...base,
    balance: 30_000.01,
    payouts: 5_000,
    minimumBalance: 10_000,
  })
  assert.equal(share.available, 15_000.01)
  assert.deepEqual(
    share.partners.map(partner => partner.amount),
    [7_500, 7_500]
  )
  assert.equal(share.shortfall, 0)
})

test('a zero minimum keeps nothing back', () => {
  const share = computeProfitShare({
    ...base,
    balance: 1_000,
    payouts: 0,
    minimumBalance: 0,
  })
  assert.equal(share.totalAmount, 1_000)
})

test('a shortfall pays nothing and says by how much', () => {
  const share = computeProfitShare({
    ...base,
    balance: 12_000,
    payouts: 5_000,
    minimumBalance: 10_000,
  })
  assert.equal(share.available, 0)
  assert.equal(share.shortfall, 3_000)
  assert.equal(share.totalAmount, 0)
})

test('frozen partners (with their old amount) are paid the new amount', () => {
  const frozen = base.partners.map(partner => ({ ...partner, amount: 99 }))
  const share = computeProfitShare({
    ...base,
    partners: frozen,
    balance: 14_000,
    payouts: 0,
    minimumBalance: 10_000,
  })
  assert.deepEqual(
    share.partners.map(partner => partner.amount),
    [2_000, 2_000]
  )
})
