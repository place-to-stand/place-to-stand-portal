// Run: npx tsx --test apps/internal/lib/form-submissions/subscribe-payload.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  subscribePayloadSchema,
  toSubscribeSubmissionRow,
} from './subscribe-payload.ts'

const payload = {
  submissionId: '6f1c2b8e-3a4d-4e5f-9a7b-1c2d3e4f5a6b',
  sourceDetail: 'https://placetostandagency.com/blog/some-post',
  submittedAt: '2026-11-02T18:00:00.000Z',
  subscriber: { email: 'reader@example.com' },
  analytics: {
    posthogDistinctId: 'distinct-123',
    posthogSessionId: 'session-123',
    posthogReplayUrl: null,
  },
  attribution: {
    utmSource: 'newsletter',
    utmMedium: 'email',
    utmCampaign: 'nov',
    utmTerm: null,
    utmContent: null,
    gclid: null,
    referrer: 'https://www.google.com/',
    landingPath: '/blog/some-post',
  },
  client: {
    viewport: 'mobile',
    screenWidth: 390,
    timezone: 'America/Denver',
    language: 'en-US',
    userAgent: 'Mozilla/5.0 (visitor)',
  },
}

test('the contract payload parses', () => {
  const parsed = subscribePayloadSchema.safeParse(payload)
  assert.equal(parsed.success, true)
})

test('a missing or invalid email is rejected', () => {
  assert.equal(
    subscribePayloadSchema.safeParse({ ...payload, subscriber: {} }).success,
    false
  )
  assert.equal(
    subscribePayloadSchema.safeParse({
      ...payload,
      subscriber: { email: 'not-an-email' },
    }).success,
    false
  )
})

test('submissionId must be a uuid and submittedAt an ISO datetime', () => {
  assert.equal(
    subscribePayloadSchema.safeParse({ ...payload, submissionId: 'abc' })
      .success,
    false
  )
  assert.equal(
    subscribePayloadSchema.safeParse({ ...payload, submittedAt: 'yesterday' })
      .success,
    false
  )
})

test('the envelope blocks are required, as for contact', () => {
  assert.equal(
    subscribePayloadSchema.safeParse({ ...payload, attribution: undefined })
      .success,
    false
  )
})

test('maps to a captured subscribe row with consent and no name', () => {
  const row = toSubscribeSubmissionRow(
    subscribePayloadSchema.parse(payload),
    'node-fetch'
  )

  assert.equal(row.kind, 'subscribe')
  assert.equal(row.status, 'captured')
  assert.equal(row.sessionKey, payload.submissionId)
  assert.equal(row.sourceDetail, payload.sourceDetail)
  assert.equal(row.contactEmail, 'reader@example.com')
  assert.equal(row.marketingConsent, true)
  assert.equal(row.contactName, null)
  assert.equal(row.contactCompany, null)
  assert.equal(row.message, null)
  assert.equal(row.subject, null)
  assert.equal(row.deliveryRequestedAt, null)
  assert.equal(row.capturedAt, payload.submittedAt)
  assert.equal(row.lastActivityAt, payload.submittedAt)
  assert.equal(row.utmSource, 'newsletter')
  assert.equal(row.landingPath, '/blog/some-post')
  assert.equal(row.posthogDistinctId, 'distinct-123')
  assert.equal(row.viewport, 'mobile')
})

test('the payload user agent wins over the request header', () => {
  const parsed = subscribePayloadSchema.parse(payload)
  assert.equal(
    toSubscribeSubmissionRow(parsed, 'node-fetch').userAgent,
    'Mozilla/5.0 (visitor)'
  )
  assert.equal(
    toSubscribeSubmissionRow(
      { ...parsed, client: { ...parsed.client, userAgent: null } },
      'node-fetch'
    ).userAgent,
    'node-fetch'
  )
})
