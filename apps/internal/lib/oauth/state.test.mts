// Run: npx tsx --test apps/internal/lib/oauth/state.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeReturnPath } from './state-path.ts'

test('keeps a path inside the portal', () => {
  assert.equal(
    safeReturnPath('/leads?lead=11111111-1111-4111-8111-111111111111'),
    '/leads?lead=11111111-1111-4111-8111-111111111111'
  )
})

test('never sends anyone to another site', () => {
  for (const bad of [
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    'https://evil.com',
    'evil.com',
    '',
    null,
  ]) {
    const result = safeReturnPath(bad)
    assert.ok(result === null || result.startsWith('/'), String(bad))
    if (result) assert.ok(!result.startsWith('//'), String(bad))
  }
  assert.equal(safeReturnPath('/\t/evil.com'), null)
  assert.equal(safeReturnPath('//evil.com'), null)
})
