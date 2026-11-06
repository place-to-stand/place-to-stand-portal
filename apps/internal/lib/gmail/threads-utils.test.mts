// Run: npx tsx --test apps/internal/lib/gmail/threads-utils.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAddressQuery,
  decodeGmailSnippet,
  gmailThreadUrl,
  isGmailAuthFailure,
  mapWithConcurrency,
  parseFromName,
} from './threads-utils.ts'

test('searches from, to and cc for each address, once', () => {
  assert.equal(
    buildAddressQuery(['Ada@Example.com', 'ada@example.com ']),
    '{from:ada@example.com to:ada@example.com cc:ada@example.com bcc:ada@example.com}'
  )
})

test('drops anything that is not an address, so it cannot widen the search', () => {
  assert.equal(buildAddressQuery(['', 'not an email', 'a@b.c OR x']), null)
  assert.equal(buildAddressQuery(['{from:*}@x.com']), null)
})

test('decodes the HTML escapes Gmail puts in snippets', () => {
  assert.equal(
    decodeGmailSnippet('It&#39;s &quot;done&quot; &amp; &lt;ok&gt; &#x2014;'),
    'It\'s "done" & <ok> —'
  )
})

test('names the sender', () => {
  assert.equal(
    parseFromName('"Ada Lovelace" <ada@example.com>'),
    'Ada Lovelace'
  )
  assert.equal(parseFromName('<ada@example.com>'), 'ada@example.com')
  assert.equal(parseFromName('ada@example.com'), 'ada@example.com')
  assert.equal(parseFromName(null), null)
})

test('opens the thread in the account it belongs to', () => {
  assert.equal(
    gmailThreadUrl('1a18d2d1749e2961', 'jason@placetostandagency.com'),
    // The link Gmail's own API hands back for this thread.
    'https://mail.google.com/mail/?authuser=jason%40placetostandagency.com#all/thread-f:1880484641473702241'
  )
})

test('only a bad token asks for a reconnect, never a rate limit', () => {
  assert.equal(isGmailAuthFailure(401, ''), true)
  assert.equal(
    isGmailAuthFailure(403, '{"reason":"insufficientPermissions"}'),
    true
  )
  assert.equal(
    isGmailAuthFailure(403, '{"reason":"userRateLimitExceeded"}'),
    false
  )
  assert.equal(isGmailAuthFailure(429, ''), false)
  assert.equal(isGmailAuthFailure(404, ''), false)
})

test('runs a few at a time, keeps order, and keeps going past a failure', async () => {
  let running = 0
  let peak = 0
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async n => {
    running += 1
    peak = Math.max(peak, running)
    await new Promise(resolve => setTimeout(resolve, 5))
    running -= 1
    if (n === 3) throw new Error('gone')
    return n * 10
  })
  assert.equal(peak, 2)
  assert.deepEqual(
    results.map(r => (r.status === 'fulfilled' ? r.value : 'x')),
    [10, 20, 'x', 40, 50, 60]
  )
})
