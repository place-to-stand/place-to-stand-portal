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
 *   npx tsx scripts/test-google-chat.ts <invoiceNumber> <total> <clientName>
 *   npx tsx scripts/test-google-chat.ts INV-1042 4500.00 "Acme Co."
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'

import { buildInvoicePaidCard } from '../lib/notifications/google-chat-messages'

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

  const [invoiceNumber, total, clientName] = process.argv.slice(2)

  const notice = {
    invoiceNumber: invoiceNumber ?? 'INV-TEST-001',
    total: total ?? '4500.00',
    clientName: clientName ?? 'Test Client',
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

  console.log(`Google Chat responded: ${response.status} ${response.statusText}`)
  if (body) console.log(body)

  if (!response.ok) {
    throw new Error(`Webhook POST failed with status ${response.status}`)
  }

  console.log('✅ Sent. Check the Sales channel.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
