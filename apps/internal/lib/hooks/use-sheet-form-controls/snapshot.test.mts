// Run: npx tsx --test apps/internal/lib/hooks/use-sheet-form-controls/snapshot.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildSnapshot,
  stableStringify,
  withLoadedDefaults,
} from './snapshot.ts'

const external = { own: null, sources: {} }
const entry = (values: Record<string, unknown>) =>
  buildSnapshot(values, external)

test('equal values compare equal whatever their key order', () => {
  assert.equal(
    stableStringify({ a: 1, b: { c: 2, d: 3 } }),
    stableStringify({ b: { d: 3, c: 2 }, a: 1 })
  )
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }))
})

test('a late-loaded field replaces its placeholder in an entry', () => {
  const loaded = withLoadedDefaults(
    entry({ name: 'Acme edited', memberIds: undefined }),
    { name: 'Acme', memberIds: undefined },
    { name: 'Acme', memberIds: ['u1', 'u2'] }
  )
  assert.deepEqual(loaded.values, {
    name: 'Acme edited',
    memberIds: ['u1', 'u2'],
  })
})

test('an edit made while the field loaded is kept', () => {
  const loaded = withLoadedDefaults(
    entry({ memberIds: ['u9'] }),
    { memberIds: undefined },
    { memberIds: ['u1'] }
  )
  assert.deepEqual(loaded.values, { memberIds: ['u9'] })
})

test('nested values merge key by key', () => {
  const loaded = withLoadedDefaults(
    entry({ signIn: { role: 'ADMIN', enabled: false }, titles: { a: 'CEO' } }),
    { signIn: { role: undefined, enabled: false }, titles: { a: '' } },
    { signIn: { role: 'SALES', enabled: true }, titles: { a: '' } }
  )
  // role was edited (kept); enabled was still the placeholder (loaded).
  assert.deepEqual(loaded.values, {
    signIn: { role: 'ADMIN', enabled: true },
    titles: { a: 'CEO' },
  })
})

test('an entry untouched by the load is returned as is', () => {
  const snapshot = entry({ name: 'Acme' })
  assert.equal(
    withLoadedDefaults(snapshot, { name: 'Acme' }, { name: 'Acme' }),
    snapshot
  )
})

test('the signature follows the merged values', () => {
  const loaded = withLoadedDefaults(
    entry({ memberIds: undefined }),
    { memberIds: undefined },
    { memberIds: ['u1'] }
  )
  assert.equal(loaded.signature, entry({ memberIds: ['u1'] }).signature)
})
