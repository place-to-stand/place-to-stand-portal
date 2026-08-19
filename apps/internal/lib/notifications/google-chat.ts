import 'server-only'

import { serverEnv } from '@/lib/env.server'
import { invoiceHref } from '@/lib/sheets/hrefs'

import {
  buildInvoicePaidCard,
  type InvoicePaidNotice,
} from './google-chat-messages'

/**
 * Absolute deep link to the invoice sheet, or null when no base URL is
 * configured. Same base-URL resolution as `send-invoice.ts`; the link is built
 * here rather than at the call site so the Stripe webhook stays free of URL
 * assembly.
 */
function resolveInvoiceUrl(invoiceId: string | null | undefined): string | null {
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
 * Callers should still use a fire-and-forget pattern (`.catch(console.error)`)
 * as defense in depth.
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
