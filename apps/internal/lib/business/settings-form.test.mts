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
  logo: { kind: 'keep' },
  icon: { kind: 'keep' },
}

const errorsFor = (patch: Record<string, unknown>) => {
  const result = businessSettingsSchema.safeParse({ ...valid, ...patch })
  return result.success ? [] : result.error.issues.map(issue => issue.path[0])
}

test('the blank form saves (only the name is required)', () => {
  assert.deepEqual(errorsFor({}), [])
})

test('the name stays on one line', () => {
  assert.deepEqual(errorsFor({ name: 'Evil\r\nBcc: x@y.z' }), ['name'])
})
