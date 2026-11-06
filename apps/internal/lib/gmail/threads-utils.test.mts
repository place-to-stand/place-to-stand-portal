// Run: npx tsx --test apps/internal/lib/gmail/threads-utils.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildAddressQuery,
  decodeGmailSnippet,
  gmailThreadUrl,
  parseFromName,
} from './threads-utils.ts'

test('searches from, to and cc for each address, once', () => {
  assert.equal(
    buildAddressQuery(['Ada@Example.com', 'ada@example.com ']),
    '{from:ada@example.com to:ada@example.com cc:ada@example.com}'
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
    gmailThreadUrl('18c2', 'dave@placetostand.agency'),
    'https://mail.google.com/mail/?authuser=dave%40placetostand.agency#all/18c2'
  )
})
