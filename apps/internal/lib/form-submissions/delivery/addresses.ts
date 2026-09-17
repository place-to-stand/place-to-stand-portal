import 'server-only'

import { serverEnv } from '@/lib/env.server'

/**
 * Sender and inbox for the marketing form emails. Separate from the portal's
 * own transactional sender so visitors keep seeing `hello@…`, the address the
 * marketing site sent from before PRD 008 moved the sends here.
 */
export function resolveFormEmailAddresses() {
  return {
    from: `Place To Stand <${serverEnv.RESEND_FORMS_FROM_EMAIL ?? serverEnv.RESEND_FROM_EMAIL}>`,
    /** Receives team notifications, and is the Reply-To on visitor mail. */
    teamInbox: serverEnv.FORMS_NOTIFY_EMAIL ?? serverEnv.RESEND_REPLY_TO_EMAIL,
  }
}

/** Origin for links back into the admin portal. */
export function resolvePortalOrigin(): string {
  return (
    serverEnv.APP_BASE_URL ?? new URL(serverEnv.GOOGLE_REDIRECT_URI).origin
  ).replace(/\/+$/, '')
}
