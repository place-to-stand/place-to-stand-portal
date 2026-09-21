/**
 * Dev utility: send a sample "Invoice Paid" card to the Google Chat Sales space.
 *
 * Because there is no Stripe sandbox, this lets you verify the webhook URL and
 * message rendering on demand without processing a real payment. It exercises
 * the exact production card format via `buildInvoicePaidCard`.
 *
 * Run (from apps/internal, with GOOGLE_CHAT_SALES_WEBHOOK_URL available):
 *   npx tsx scripts/test-google-chat.ts
 *
 * Optionally override the sample data via positional args:
 *   npx tsx scripts/test-google-chat.ts <invoiceNumber> <total> <clientName> <invoiceUrl>
 *   npx tsx scripts/test-google-chat.ts INV-1042 4500.00 "Acme Co."
 *
 * The "View invoice" button only renders when an invoice URL is present, so the
 * sample falls back to APP_BASE_URL (or localhost) with a placeholder id.
 *
 * `--stuck` sends the PRD 008 "form emails not sent" card instead, so the
 * alert the retry sweep posts can be eyeballed without breaking Resend:
 *   npx tsx scripts/test-google-chat.ts --stuck
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'

import {
  buildInvoicePaidCard,
  buildStuckEmailCard,
} from '../lib/notifications/google-chat-messages'

// Mirror drizzle.config.ts / dedupe-sales-project.ts env loading so the script
// can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

async function main() {
  const webhookUrl = process.env.GOOGLE_CHAT_SALES_WEBHOOK_URL

  if (!webhookUrl) {
    throw new Error(
      'GOOGLE_CHAT_SALES_WEBHOOK_URL is not set. Add it to .env.local or .env first.'
    )
  }

  const baseUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  if (process.argv.includes('--stuck')) {
    const card = buildStuckEmailCard(
      {
        thresholdMinutes: 60,
        items: [
          {
            label: 'Jordan Sample',
            kind: 'contact',
            url: `${baseUrl}/submissions?submission=00000000-0000-4000-8000-000000000000`,
          },
          { label: 'sample@example.com', kind: 'audit', url: null },
        ],
      },
      { test: true }
    )
    console.log('Sending sample stuck-email card')
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })
    if (!response.ok) {
      throw new Error(
        `Webhook rejected the card: ${response.status} ${await response.text()}`
      )
    }
    console.log('Sent. Check the Sales space.')
    return
  }

  const [invoiceNumber, total, clientName, invoiceUrl] = process.argv.slice(2)

  const notice = {
    invoiceNumber: invoiceNumber ?? 'INV-TEST-001',
    total: total ?? '4500.00',
    clientName: clientName ?? 'Test Client',
    invoiceUrl:
      invoiceUrl ??
      `${baseUrl}/invoices?invoice=00000000-0000-4000-8000-000000000000`,
  }

  console.log('Sending sample invoice-paid card:', notice)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `test: true` adds a "TEST MESSAGE" subtitle so the card is obviously
    // not a real payment.
    body: JSON.stringify(buildInvoicePaidCard(notice, { test: true })),
  })

  const body = await response.text().catch(() => '')

  console.log(
    `Google Chat responded: ${response.status} ${response.statusText}`
  )
  if (body) console.log(body)

  if (!response.ok) {
    throw new Error(`Webhook POST failed with status ${response.status}`)
  }

  console.log('✅ Sent. Check the Sales channel.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
