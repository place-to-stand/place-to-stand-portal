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
  /**
   * Absolute URL of the invoice in the portal. The card gets a "View invoice"
   * button only when this is set — Google Chat renders a relative URL as a dead
   * link, so a missing base URL must drop the button rather than emit one.
   */
  invoiceUrl?: string | null
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
                ...(notice.invoiceUrl
                  ? [
                      {
                        buttonList: {
                          buttons: [
                            {
                              text: 'View invoice',
                              onClick: {
                                openLink: { url: notice.invoiceUrl },
                              },
                            },
                          ],
                        },
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
      },
    ],
  }
}

export type StuckEmailNotice = {
  /** Rows whose email is still unsent past the alert threshold. */
  items: Array<{
    /** Visitor name or email, whatever the row has. */
    label: string
    kind: 'audit' | 'contact'
    /** Absolute portal link to the submission; null when no base URL is set. */
    url: string | null
  }>
  thresholdMinutes: number
}

/**
 * Build a Google Chat `cardsV2` payload warning that marketing form emails
 * are stuck. One card per sweep run, listing every row that just crossed the
 * threshold, so an outage reads as one message rather than one per lead.
 */
export function buildStuckEmailCard(
  notice: StuckEmailNotice,
  options?: { test?: boolean }
): object {
  const count = notice.items.length
  return {
    cardsV2: [
      {
        cardId: 'submission-email-stuck',
        card: {
          header: {
            title: `✉️ ${count} form ${count === 1 ? 'email' : 'emails'} not sent`,
            subtitle: options?.test
              ? '⚠️ TEST MESSAGE — not a real failure'
              : `Still unsent ${notice.thresholdMinutes} min after the submission. The lead is recorded and flagged unread; the sweep keeps retrying.`,
          },
          sections: [
            {
              widgets: notice.items.map(item => ({
                decoratedText: {
                  topLabel: item.kind === 'audit' ? 'Audit' : 'Contact',
                  text: item.label,
                  ...(item.url
                    ? {
                        button: {
                          text: 'Open',
                          onClick: { openLink: { url: item.url } },
                        },
                      }
                    : {}),
                },
              })),
            },
          ],
        },
      },
    ],
  }
}
