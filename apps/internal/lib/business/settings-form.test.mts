// Run: npx tsx --test apps/internal/lib/business/settings-form.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { businessSettingsSchema } from './settings-form.ts'

const valid = {
  name: 'Test Agency',
  legalName: '',
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  inboxEmail: '',
  sendingEmail: '',
  bookingUrl: '',
  timeZone: 'America/Chicago',
  profitShareStartMonth: '',
  profitShareMinimumBalance: '',
  profitSharePartnerIds: [],
  logo: { kind: 'keep' },
  icon: { kind: 'keep' },
}

const errorsFor = (patch: Record<string, unknown>) => {
  const result = businessSettingsSchema.safeParse({ ...valid, ...patch })
  return result.success ? [] : result.error.issues.map(issue => issue.path[0])
}

test('a blank profit share saves (it is off)', () => {
  assert.deepEqual(errorsFor({}), [])
})

test('the start month takes YYYY-MM in a real year only', () => {
  assert.deepEqual(errorsFor({ profitShareStartMonth: '2026-08' }), [])
  for (const bad of ['2026-13', '2026-00', '0000-01', '2026-8', 'August']) {
    assert.deepEqual(errorsFor({ profitShareStartMonth: bad }), [
      'profitShareStartMonth',
    ])
  }
})

test('the minimum is dollars with at most two decimals', () => {
  for (const ok of ['10000', '10000.5', '0.99', '']) {
    assert.deepEqual(errorsFor({ profitShareMinimumBalance: ok }), [], ok)
  }
  for (const bad of ['abc', '-5', '1,000', '10.999', '12345678901']) {
    assert.deepEqual(
      errorsFor({ profitShareMinimumBalance: bad }),
      ['profitShareMinimumBalance'],
      bad
    )
  }
})

test('partners must be ids', () => {
  assert.deepEqual(
    errorsFor({
      profitSharePartnerIds: ['11111111-1111-4111-8111-111111111111'],
    }),
    []
  )
  assert.deepEqual(errorsFor({ profitSharePartnerIds: ['jason'] }), [
    'profitSharePartnerIds',
  ])
})

test('the name stays on one line', () => {
  assert.deepEqual(errorsFor({ name: 'Evil\r\nBcc: x@y.z' }), ['name'])
})
