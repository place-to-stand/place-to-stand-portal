// Run: npx tsx --test apps/internal/lib/billing/billing-settings-form.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  billingSettingsSchema,
  productKey,
  profitShareKey,
  taxRateKey,
} from './billing-settings-form.ts'

const product = {
  id: 'new-00000000-0000-4000-8000-000000000001',
  name: 'Development Hours',
  description: null,
  unit_price: '200.00',
  unit_label: 'hour',
  creates_hour_block_default: true,
  is_active: true,
  min_quantity: 5,
  sort_order: 0,
}
const taxRate = {
  id: 'new-00000000-0000-4000-8000-000000000002',
  state: 'TX',
  rate: '0.0825',
  label: 'TX Sales Tax',
  is_active: true,
  created_at: '',
  updated_at: '',
}
const valid = {
  profitShareStartMonth: '2026-08',
  profitShareMinimumBalance: '10000',
  profitSharePartnerIds: [],
  products: [product],
  taxRates: [taxRate],
}

const errorsFor = (patch: Record<string, unknown>) => {
  const result = billingSettingsSchema.safeParse({ ...valid, ...patch })
  return result.success
    ? []
    : result.error.issues.map(issue => issue.path.join('.'))
}

test('the whole page saves with rows and the profit share', () => {
  assert.deepEqual(errorsFor({}), [])
})

test('a unit price is dollars with at most two decimals', () => {
  for (const ok of ['200', '200.5', '0.99']) {
    assert.deepEqual(
      errorsFor({ products: [{ ...product, unit_price: ok }] }),
      [],
      ok
    )
  }
  for (const bad of ['', 'abc', '-5', '1,000', '1.999']) {
    assert.deepEqual(
      errorsFor({ products: [{ ...product, unit_price: bad }] }),
      ['products.0.unit_price'],
      bad
    )
  }
})

test('a tax rate is a fraction under 1 (under 100%)', () => {
  assert.deepEqual(errorsFor({ taxRates: [{ ...taxRate, rate: '0' }] }), [])
  for (const bad of ['', 'abc', '-0.1', '1', '8.25']) {
    assert.deepEqual(
      errorsFor({ taxRates: [{ ...taxRate, rate: bad }] }),
      ['taxRates.0.rate'],
      bad
    )
  }
})

test('rows need a name or label', () => {
  assert.deepEqual(
    errorsFor({
      products: [{ ...product, name: ' ' }],
      taxRates: [{ ...taxRate, label: '' }],
    }),
    ['products.0.name', 'taxRates.0.label']
  )
})

test('rejects ids that are neither a uuid nor a new row', () => {
  assert.deepEqual(errorsFor({ products: [{ ...product, id: 'abc' }] }), [
    'products.0.id',
  ])
  assert.deepEqual(
    errorsFor({
      products: [{ ...product, id: '6f1c3a1e-2b7d-4c8e-9f00-1a2b3c4d5e6f' }],
    }),
    []
  )
})

test('a state is two capital letters, one rate per state', () => {
  assert.deepEqual(errorsFor({ taxRates: [{ ...taxRate, state: 'Texas' }] }), [
    'taxRates.0.state',
  ])
  assert.deepEqual(
    errorsFor({
      taxRates: [
        taxRate,
        {
          ...taxRate,
          id: 'new-00000000-0000-4000-8000-000000000003',
          label: 'Other',
        },
      ],
    }),
    ['taxRates.1.state']
  )
})

test('integers stay within a database integer', () => {
  assert.deepEqual(
    errorsFor({ products: [{ ...product, sort_order: 2 ** 31 }] }),
    ['products.0.sort_order']
  )
})

test('the same values compare equal however they are written', () => {
  assert.equal(
    productKey({ ...product, unit_price: '200' }),
    productKey({ ...product, unit_price: '200.00' })
  )
  assert.notEqual(
    productKey({ ...product, unit_price: '201' }),
    productKey(product)
  )
  assert.equal(
    taxRateKey({ ...taxRate, rate: '0.082500' }),
    taxRateKey(taxRate)
  )
  assert.equal(
    profitShareKey({ ...valid, profitShareMinimumBalance: '10000.00' }),
    profitShareKey(valid)
  )
})
