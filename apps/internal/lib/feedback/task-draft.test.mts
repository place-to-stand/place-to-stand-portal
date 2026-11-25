// Run: npx tsx --test apps/internal/lib/feedback/task-draft.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { feedbackTaskDraft } from './task-draft.ts'

const base = {
  type: 'bug' as const,
  pageUrl: null,
  pageTitle: null,
  reporterName: null,
  reporterEmail: null,
  posthogReplayUrl: null,
}

test('title is the type and the first line, cut at 80 characters', () => {
  assert.equal(
    feedbackTaskDraft({ ...base, message: '\n  Cart total is wrong\nmore' })
      .title,
    'Bug: Cart total is wrong'
  )
  const long = feedbackTaskDraft({ ...base, message: 'x'.repeat(200) }).title
  assert.equal(long, `Bug: ${'x'.repeat(79)}…`)
})

test('the message is escaped into paragraphs', () => {
  const { description } = feedbackTaskDraft({
    ...base,
    message: 'Line <b>one</b>\nline two\n\n<script>x</script>',
  })
  assert.equal(
    description,
    '<p>Line &lt;b&gt;one&lt;/b&gt;<br>line two</p><p>&lt;script&gt;x&lt;/script&gt;</p>'
  )
})

test('page, reporter and replay go at the end, escaped', () => {
  const { description } = feedbackTaskDraft({
    ...base,
    type: 'question',
    message: 'Where?',
    pageUrl: 'https://shop.example.com/cart?a=1&b="2"',
    pageTitle: null,
    reporterName: 'Dana Example',
    reporterEmail: 'dana@example.com',
    posthogReplayUrl: 'https://us.posthog.com/replay/abc',
  })
  assert.equal(
    description,
    '<p>Where?</p><p>Page: <a href="https://shop.example.com/cart?a=1&amp;b=&quot;2&quot;">https://shop.example.com/cart?a=1&amp;b=&quot;2&quot;</a><br>From: Dana Example, dana@example.com<br><a href="https://us.posthog.com/replay/abc">Session replay</a></p>'
  )
})
