// Run: npx tsx --test apps/internal/lib/feedback/payload.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  feedbackFieldsFromForm,
  feedbackPayloadSchema,
  isPostHogReplayUrl,
  sniffScreenshotType,
} from './payload.ts'

const KEY = '3f1b8c2e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'

test('a minimal report parses, empty fields become null', () => {
  const parsed = feedbackPayloadSchema.parse({
    key: KEY,
    type: 'bug',
    message: '  The cart total is wrong  ',
    email: '',
  })
  assert.equal(parsed.message, 'The cart total is wrong')
  assert.equal(parsed.email, null)
  assert.equal(parsed.pageUrl, null)
  assert.equal(parsed.elapsedMs, undefined)
})

test('bad values are refused', () => {
  const base = { key: KEY, type: 'bug', message: 'Hi' }
  for (const bad of [
    { key: 'not-a-uuid' },
    { type: 'praise' },
    { message: '   ' },
    { message: 'x'.repeat(5001) },
    { email: 'nope' },
    { pageUrl: 'javascript:alert(1)' },
    { posthogReplayUrl: 'https://posthog.com.evil.test/replay/1' },
    { posthogReplayUrl: 'http://us.posthog.com/replay/1' },
  ]) {
    assert.equal(
      feedbackPayloadSchema.safeParse({ ...base, ...bad }).success,
      false,
      JSON.stringify(bad)
    )
  }
})

test('form fields are read as text, elapsed time as a number', () => {
  const form = new FormData()
  form.set('key', KEY)
  form.set('type', 'question')
  form.set('message', 'Where is the export?')
  form.set('elapsedMs', '4200')
  form.set('name', new Blob(['x']))
  const fields = feedbackFieldsFromForm(form)
  assert.equal(fields.name, undefined)
  assert.equal(feedbackPayloadSchema.parse(fields).elapsedMs, 4200)
})

test('replay links must be PostHog over https', () => {
  assert.equal(isPostHogReplayUrl('https://us.posthog.com/replay/abc'), true)
  assert.equal(isPostHogReplayUrl('https://posthog.com/replay/abc'), true)
  assert.equal(isPostHogReplayUrl('https://evilposthog.com/replay'), false)
})

test('screenshots are typed by their bytes', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg">'
  )
  assert.equal(sniffScreenshotType(png), 'image/png')
  assert.equal(sniffScreenshotType(jpeg), 'image/jpeg')
  assert.equal(sniffScreenshotType(webp), 'image/webp')
  assert.equal(sniffScreenshotType(svg), null)
  assert.equal(sniffScreenshotType(new Uint8Array()), null)
})
