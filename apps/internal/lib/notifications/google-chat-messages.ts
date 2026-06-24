/**
 * Google Chat message builders.
 *
 * This module is intentionally free of `server-only` and any `env.server`
 * dependency so it can be imported from both the server-side notifier
 * (`google-chat.ts`) and the standalone `tsx` test script
 * (`scripts/test-google-chat.ts`). Keep it pure — payload construction only.
 */

export type InvoicePaidNotice = {
  invoiceNumber?: string | null
  total?: string | null
  clientName?: string | null
}

const formatCurrency = (amount: string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '—'
  const value = Number(amount)
  if (Number.isNaN(value)) return String(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Build a Google Chat `cardsV2` payload announcing a paid invoice.
 * See https://developers.google.com/chat/api/guides/message-formats/cards
 *
 * Pass `{ test: true }` for the dev test command — it adds a "TEST MESSAGE"
 * subtitle so the card is obviously not a real payment.
 */
export function buildInvoicePaidCard(
  notice: InvoicePaidNotice,
  options?: { test?: boolean }
): object {
  return {
    cardsV2: [
      {
        cardId: 'invoice-paid',
        card: {
          header: {
            title: '💰 Invoice Paid',
            ...(options?.test
              ? { subtitle: '⚠️ TEST MESSAGE — not a real payment' }
              : {}),
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Client',
                    text: notice.clientName ?? '—',
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Invoice',
                    text: notice.invoiceNumber ?? '—',
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Amount',
                    text: formatCurrency(notice.total),
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  }
}
