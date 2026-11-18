import 'server-only'

import { formatSender } from '@pts/email'

import { serverEnv } from '@/lib/env.server'

/**
 * Sender and inbox for the marketing form emails. Separate from the portal's
 * own transactional sender so visitors keep seeing `hello@…`, the address the
 * marketing site sent from before PRD 008 moved the sends here.
 */
export function resolveFormEmailAddresses(business: {
  name: string
  inboxEmail: string | null
}) {
  const fromAddress =
    serverEnv.RESEND_FORMS_FROM_EMAIL ?? serverEnv.RESEND_FROM_EMAIL
  return {
    from: formatSender(business.name, fromAddress),
    /**
     * Receives team notifications, and is the Reply-To on visitor mail:
     * FORMS_NOTIFY_EMAIL, else the Business page's inbox email.
     */
    teamInbox:
      serverEnv.FORMS_NOTIFY_EMAIL ?? business.inboxEmail ?? fromAddress,
  }
}

/** Origin for links back into the internal portal. */
export function resolvePortalOrigin(): string {
  return (
    serverEnv.APP_BASE_URL ?? new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  ).replace(/\/+$/, '')
}
