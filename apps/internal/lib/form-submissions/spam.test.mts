// Run: npx tsx --test apps/internal/lib/form-submissions/spam.test.mts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { detectContactSpam, looksLikeSalesPitch, MIN_FILL_MS } from './spam.ts'

// Made-up messages shaped like the pitches the contact form gets.
const PITCHES: Record<string, string> = {
  leadList: `Hi There,

Would information on companies using Acme CRM be relevant to your team?

I can share a few sample records for your review.

Regards,
Pat`,
  leadListTwo: `Hello,

We help businesses connect with companies using Widget Ledger, Widget Ledger Pro and Widget Cloud, based on their target market.

Happy to provide a few examples.

Best regards,
Sam Example`,
  pricedReport: `Hello team,

Your process mixes AI tools with human review. Our Example Guide report provides a reference for documenting what changed.

The $49 Release v2.1 package, plus applicable tax, includes 40 pages.

Advertisement. To stop marketing from Example Publishing LLC, email info@example.com with "stop".`,
  servicesPitch: `I hope you’re doing well.

I’m reaching out to briefly connect regarding billing support for your practice.

We help healthcare providers streamline their paperwork.

We also offer website development and SEO/marketing services to help strengthen your presence.

A quick reply with “Yes, interested” or “Not at this time” works perfectly.`,
  seo: `Hello dear, I noticed your website is not on the first page of Google. We offer SEO and link building services at low prices.`,
}

// Made-up messages shaped like real enquiries, including cold-email
// politeness that must not flag on its own.
const ENQUIRIES: Record<string, string> = {
  maintenance:
    "I'm looking for a technical partner to provide ongoing maintenance for our member app. It uses Next.js, React, TypeScript, Vercel, Supabase and Resend. I want a service that will work with me to take over maintenance and help with new features.",
  politeClient:
    "I hope you're doing well. I'm reaching out because we help small clinics with scheduling and we need a booking app our patients can use. Would you be open to a quick call next week?",
  shopOwner:
    'We run a hot sauce shop on Shopify. We offer wholesale and subscriptions, and our current theme is slow. Can you rebuild it? Budget is around $8,000.',
  agency:
    'We are a marketing agency and we offer SEO services to our clients. We need a developer to build a reporting dashboard for them.',
  short: 'new project',
  question: 'Do you build mobile apps as well as websites?',
  ambassador:
    'Hey! Looking to get in touch with one of the founders about a meetup we are planning. Would love to chat.',
}

for (const [name, message] of Object.entries(PITCHES)) {
  test(`flags pitch: ${name}`, () => {
    assert.equal(
      looksLikeSalesPitch({ subject: 'General question', message }),
      true
    )
  })
}

for (const [name, message] of Object.entries(ENQUIRIES)) {
  test(`keeps enquiry: ${name}`, () => {
    assert.equal(
      looksLikeSalesPitch({ subject: 'New project', message }),
      false
    )
  })
}

test('the subject counts too', () => {
  assert.equal(
    looksLikeSalesPitch({
      subject: 'Report offer: the $49 package',
      message:
        'Our Example report provides a checklist for your team.\n\nAdvertisement. To stop marketing from us, reply stop.',
    }),
    true
  )
})

test('empty text is not a pitch', () => {
  assert.equal(looksLikeSalesPitch({ subject: null, message: null }), false)
})

test('honeypot wins over everything', () => {
  assert.equal(
    detectContactSpam({
      message: ENQUIRIES.maintenance,
      bot: { honeypot: true, elapsedMs: 60_000 },
    }),
    'honeypot'
  )
})

test('too fast flags under the minimum, not at it', () => {
  assert.equal(
    detectContactSpam({
      message: ENQUIRIES.question,
      bot: { honeypot: false, elapsedMs: MIN_FILL_MS - 1 },
    }),
    'too_fast'
  )
  assert.equal(
    detectContactSpam({
      message: ENQUIRIES.question,
      bot: { honeypot: false, elapsedMs: MIN_FILL_MS },
    }),
    null
  )
})

test('unknown timing is not too fast', () => {
  assert.equal(
    detectContactSpam({
      message: ENQUIRIES.question,
      bot: { honeypot: false, elapsedMs: null },
    }),
    null
  )
})

test('no bot signals (older site deploy) falls back to wording', () => {
  assert.equal(detectContactSpam({ message: ENQUIRIES.question }), null)
  assert.equal(detectContactSpam({ message: PITCHES.leadList }), 'sales_pitch')
})
