import 'server-only'

import { serverEnv } from '@/lib/env.server'
import { STUCK_ALERT_AFTER_MINUTES } from '@/lib/form-submissions/delivery/constants'
import { invoiceHref, submissionHref } from '@/lib/sheets/hrefs'
import type { TemplateAudience } from '@/lib/templates/audience'

import {
  buildInvoicePaidCard,
  buildStuckEmailCard,
} from './google-chat-messages'

/** A Google Chat `cardsV2` payload, exactly as the notifier posts it. */
export type ChatCardPayload = ReturnType<typeof buildInvoicePaidCard>

export type NotificationTemplateEntry = {
  id: string
  name: string
  /** Where it lands, for the section heading: "Google Chat · Sales". */
  channel: string
  /** One plain sentence on when it goes out: no routes, flags, or file paths. */
  overview: string
  description: string
  audiences: TemplateAudience[]
  /**
   * Whether the destination is configured in this environment. Never the
   * webhook itself — it is a credential.
   */
  configured: boolean
  triggers: string[]
  delivery: string
  source: string
  sample: ChatCardPayload
}

const SAMPLE_INVOICE_ID = '00000000-0000-4000-a000-000000000002'
const SAMPLE_SUBMISSION_IDS = [
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000004',
]

const CHAT_DELIVERY =
  'Posted to the Google Chat Sales space through its incoming webhook (GOOGLE_CHAT_SALES_WEBHOOK_URL). Skipped when the webhook is unset, and a failed post is logged, never retried or surfaced to the user.'

/**
 * Every notification the portal pushes outside itself, rendered with
 * placeholder data through the same builders the notifier uses. Google Chat is
 * the only channel today (audited Sep 2026: no Slack, SMS, or other webhooks).
 */
export function buildNotificationCatalog(): NotificationTemplateEntry[] {
  const origin = new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  const configured = Boolean(serverEnv.GOOGLE_CHAT_SALES_WEBHOOK_URL)

  return [
    {
      id: 'invoice-paid',
      name: 'Invoice paid',
      channel: 'Google Chat · Sales',
      overview: 'Posted when a client pays an invoice.',
      description:
        'Tells the sales space a payment came in: client, invoice number, and amount, with a button to the invoice. Sent once per invoice; a replayed Stripe event does not post again.',
      audiences: ['team'],
      configured,
      triggers: [
        'Stripe reports checkout.session.completed or payment_intent.succeeded for an unpaid invoice (POST /api/integrations/stripe)',
      ],
      delivery: CHAT_DELIVERY,
      source: 'apps/internal/lib/notifications/google-chat-messages.ts',
      sample: buildInvoicePaidCard({
        invoiceNumber: 'INV-0042',
        total: '3680.50',
        clientName: 'Acme Co',
        invoiceUrl: `${origin}${invoiceHref(SAMPLE_INVOICE_ID)}`,
      }),
    },
    {
      id: 'submission-email-stuck',
      name: 'Form emails not sent',
      channel: 'Google Chat · Sales',
      overview:
        'Posted when website form emails are still unsent after an hour.',
      description:
        'Warns the sales space that marketing form emails are stuck. One card per retry sweep lists every submission that just crossed the threshold, so an outage reads as one message rather than one per lead.',
      audiences: ['team'],
      configured,
      triggers: [
        `Retry sweep (GET /api/cron/retry-submission-emails) finds submissions still unsent ${STUCK_ALERT_AFTER_MINUTES} minutes after they arrived`,
      ],
      delivery: CHAT_DELIVERY,
      source: 'apps/internal/lib/notifications/google-chat-messages.ts',
      sample: buildStuckEmailCard({
        thresholdMinutes: STUCK_ALERT_AFTER_MINUTES,
        items: [
          {
            label: 'Jordan Sample',
            kind: 'audit',
            url: `${origin}${submissionHref(SAMPLE_SUBMISSION_IDS[0])}`,
          },
          {
            label: 'casey@example.com',
            kind: 'contact',
            url: `${origin}${submissionHref(SAMPLE_SUBMISSION_IDS[1])}`,
          },
        ],
      }),
    },
  ]
}
