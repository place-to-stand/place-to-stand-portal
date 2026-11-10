// Run: npx tsx --test apps/internal/lib/tags/names.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  normalizeTagName,
  sameTagNames,
  splitTagInput,
  tagKey,
  tagNamesSchema,
  uniqueTagNames,
} from './names.ts'

test('names trim, collapse spaces and drop commas', () => {
  assert.equal(normalizeTagName('  Production   studio '), 'Production studio')
  assert.equal(normalizeTagName('a,b'), 'a b')
  assert.equal(tagKey(' Non-Profit '), 'non-profit')
})

test('one tag per name, any case, first spelling wins', () => {
  assert.deepEqual(uniqueTagNames(['Salon', 'salon ', '', ' SALON', 'Spa']), [
    'Salon',
    'Spa',
  ])
})

test('typed text splits on commas', () => {
  assert.deepEqual(splitTagInput('salon, spa,, Salon'), ['salon', 'spa'])
})

test('same names ignores order and case', () => {
  assert.ok(sameTagNames(['Salon', 'Spa'], ['spa', 'SALON']))
  assert.ok(!sameTagNames(['Salon'], ['Salon', 'Spa']))
})

test('the save schema cleans the list and refuses long names', () => {
  assert.deepEqual(tagNamesSchema.parse([' Salon ', 'salon', 'Spa']), [
    'Salon',
    'Spa',
  ])
  assert.ok(!tagNamesSchema.safeParse(['x'.repeat(41)]).success)
  assert.ok(!tagNamesSchema.safeParse(['   ']).success)
  assert.ok(
    !tagNamesSchema.safeParse(Array.from({ length: 21 }, (_, i) => `t${i}`))
      .success
  )
})
