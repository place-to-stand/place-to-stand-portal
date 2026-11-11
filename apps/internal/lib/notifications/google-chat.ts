import 'server-only'

import { serverEnv } from '@/lib/env.server'
import { invoiceHref } from '@/lib/sheets/hrefs'

import {
  buildInvoicePaidCard,
  buildStuckEmailCard,
  buildUnbookedPaymentCard,
  type InvoicePaidNotice,
  type StuckEmailNotice,
  type UnbookedPaymentNotice,
} from './google-chat-messages'

/** Long enough for Google Chat, short of Stripe's webhook timeout. */
const POST_TIMEOUT_MS = 5000

/**
 * Absolute deep link to the invoice sheet, or null when no base URL is
 * configured. Same base-URL resolution as `send-invoice.ts`; the link is built
 * here rather than at the call site so the Stripe webhook stays free of URL
 * assembly.
 */
function resolveInvoiceUrl(
  invoiceId: string | null | undefined
): string | null {
  if (!invoiceId) return null

  const baseUrl =
    serverEnv.APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (!baseUrl) return null

  return `${baseUrl}${invoiceHref(invoiceId)}`
}

/**
 * Notify the team's Google Chat Sales space that an invoice was paid.
 *
 * No-ops when `GOOGLE_CHAT_SALES_WEBHOOK_URL` is unset, and never throws —
 * notification failures must not break the Stripe webhook / payment flow.
 * Callers must await it: on Vercel an unawaited fetch is frozen with the
 * function once the response is sent and never arrives. Each post gives up
 * after `POST_TIMEOUT_MS` so a slow Google can't hold up the webhook.
 */
export async function notifyInvoicePaid(
  notice: InvoicePaidNotice & { invoiceId?: string | null }
): Promise<void> {
  const webhookUrl = serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL

  if (!webhookUrl) return

  const { invoiceId, ...rest } = notice
  const card = buildInvoicePaidCard({
    ...rest,
    invoiceUrl: rest.invoiceUrl ?? resolveInvoiceUrl(invoiceId),
  })

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
      body: JSON.stringify(card),
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

/**
 * Warn the Sales space that Stripe took money for an invoice the portal
 * would not book. Same contract as `notifyInvoicePaid`: no-op without the
 * webhook, never throws.
 */
export async function notifyUnbookedPayment(
  notice: UnbookedPaymentNotice & { invoiceId?: string | null }
): Promise<void> {
  const webhookUrl = serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL

  if (!webhookUrl) return

  const { invoiceId, ...rest } = notice
  const card = buildUnbookedPaymentCard({
    ...rest,
    invoiceUrl: rest.invoiceUrl ?? resolveInvoiceUrl(invoiceId),
  })

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(
        `[google-chat] unbooked-payment notification failed: ${response.status} ${body}`
      )
    }
  } catch (err) {
    console.error('[google-chat] unbooked-payment notification error:', err)
  }
}

/**
 * Warn the Sales space that marketing form emails are stuck (PRD 008). Same
 * contract as `notifyInvoicePaid`: no-op without the webhook, never throws —
 * the retry sweep that calls this must finish regardless.
 */
export async function notifyStuckSubmissionEmails(
  notice: StuckEmailNotice
): Promise<void> {
  const webhookUrl = serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL

  if (!webhookUrl || notice.items.length === 0) return

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
      body: JSON.stringify(buildStuckEmailCard(notice)),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(
        `[google-chat] stuck-email notification failed: ${response.status} ${body}`
      )
    }
  } catch (err) {
    console.error('[google-chat] stuck-email notification error:', err)
  }
}
