// Run: npx tsx --test apps/internal/lib/feedback/origins.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  allowedFeedbackOrigins,
  isFeedbackOriginAllowed,
  normalizeOrigin,
  parseFeedbackOriginsInput,
} from './origins.ts'

test('normalizeOrigin keeps only scheme, host and port', () => {
  assert.equal(normalizeOrigin('shop.example.com'), 'https://shop.example.com')
  assert.equal(
    normalizeOrigin('https://Shop.Example.com/cart?x=1'),
    'https://shop.example.com'
  )
  assert.equal(
    normalizeOrigin('http://localhost:3000/'),
    'http://localhost:3000'
  )
  assert.equal(normalizeOrigin('localhost:3000'), 'http://localhost:3000')
  assert.equal(normalizeOrigin(''), null)
  assert.equal(normalizeOrigin('javascript:alert(1)'), null)
  assert.equal(normalizeOrigin('ftp://example.com'), null)
  assert.equal(normalizeOrigin('https://user:pw@example.com'), null)
})

test('allowed websites combine the list and Vercel domains', () => {
  const allowed = allowedFeedbackOrigins({
    origins: ['https://shop.example.com', 'not a site'],
    productionDomains: ['app.example.com', null],
  })
  assert.deepEqual([...allowed].sort(), [
    'https://app.example.com',
    'https://shop.example.com',
  ])
})

test('only an allowed Origin header passes', () => {
  const allowed = new Set(['https://shop.example.com'])
  assert.equal(
    isFeedbackOriginAllowed('https://shop.example.com', allowed),
    true
  )
  assert.equal(
    isFeedbackOriginAllowed('http://shop.example.com', allowed),
    false
  )
  assert.equal(
    isFeedbackOriginAllowed('https://shop.example.com.evil.test', allowed),
    false
  )
  assert.equal(isFeedbackOriginAllowed('https://evil.test', allowed), false)
  assert.equal(isFeedbackOriginAllowed('null', allowed), false)
  assert.equal(isFeedbackOriginAllowed(null, allowed), false)
})

test('parseFeedbackOriginsInput splits, cleans and de-duplicates', () => {
  assert.deepEqual(
    parseFeedbackOriginsInput(
      'shop.example.com\nhttps://shop.example.com/, app.example.com'
    ),
    {
      ok: true,
      origins: ['https://shop.example.com', 'https://app.example.com'],
    }
  )
  assert.deepEqual(parseFeedbackOriginsInput('  '), { ok: true, origins: [] })
  assert.deepEqual(parseFeedbackOriginsInput('shop.example.com\nftp://x'), {
    ok: false,
    invalid: ['ftp://x'],
  })
})

test('words that are not websites are refused, not saved as hosts', () => {
  assert.deepEqual(
    parseFeedbackOriginsInput('shop.example.com\nnot a site\nstaging'),
    { ok: false, invalid: ['not a site', 'staging'] }
  )
  assert.deepEqual(
    parseFeedbackOriginsInput('localhost:3000\n127.0.0.1:8080'),
    {
      ok: true,
      origins: ['http://localhost:3000', 'http://127.0.0.1:8080'],
    }
  )
})
