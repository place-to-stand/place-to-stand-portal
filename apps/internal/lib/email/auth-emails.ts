import 'server-only'

import { renderAuthEmail, type AuthEmail, type PortalName } from '@pts/email'

import { serverEnv } from '@/lib/env.server'
import { sendEmail } from '@/lib/email/send'

/** Which portal the link opens: an admin can reset a client's password here. */
export type AuthEmailPortal = PortalName

export async function sendPasswordResetEmail(
  to: string,
  actionLink: string,
  portal: AuthEmailPortal = 'internal'
) {
  await deliver(to, { kind: 'password-reset', actionLink }, portal)
}

export async function sendMagicLinkEmail(to: string, actionLink: string) {
  await deliver(to, { kind: 'magic-link', actionLink })
}

/**
 * Confirms a password change that has already happened.
 *
 * Replaces Supabase's own `password_changed` notification, which is disabled so
 * the two can't both land. Every path that changes a password is responsible for
 * calling this — see `supabase/config.toml`.
 */
export async function sendPasswordChangedEmail(to: string) {
  await deliver(to, { kind: 'password-changed' })
}

async function deliver(
  to: string,
  auth: AuthEmail,
  portal: PortalName = 'internal'
) {
  const replyTo = serverEnv.RESEND_REPLY_TO_EMAIL
  const email = renderAuthEmail(auth, portal, replyTo)
  await sendEmail({
    from: `Place To Stand <${serverEnv.RESEND_FROM_EMAIL}>`,
    to,
    replyTo,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
}
