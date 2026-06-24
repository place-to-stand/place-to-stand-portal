import 'server-only'

import { serverEnv } from '@/lib/env.server'

import {
  buildInvoicePaidCard,
  type InvoicePaidNotice,
} from './google-chat-messages'

/**
 * Notify the team's Google Chat Sales space that an invoice was paid.
 *
 * No-ops when `GOOGLE_CHAT_SALES_WEBHOOK_URL` is unset, and never throws —
 * notification failures must not break the Stripe webhook / payment flow.
 * Callers should still use a fire-and-forget pattern (`.catch(console.error)`)
 * as defense in depth.
 */
export async function notifyInvoicePaid(
  notice: InvoicePaidNotice
): Promise<void> {
  const webhookUrl = serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL

  if (!webhookUrl) return

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildInvoicePaidCard(notice)),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(
        `[google-chat] invoice-paid notification failed: ${response.status} ${body}`
      )
    }
  } catch (err) {
    console.error('[google-chat] invoice-paid notification error:', err)
  }
}
