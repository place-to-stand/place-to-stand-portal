import 'server-only'

import {
  formatSender,
  renderAuthEmail,
  sendEmail,
  type AuthEmail,
  type TransportConfig,
} from '@pts/email'

import { emailBrandFor, getBusiness } from '@/lib/business'
import { getEnv } from '@/lib/env.server'

export async function sendPasswordResetEmail(
  to: string,
  actionLink: string
): Promise<void> {
  await deliver(to, { kind: 'password-reset', actionLink })
}

export async function sendMagicLinkEmail(
  to: string,
  actionLink: string
): Promise<void> {
  await deliver(to, { kind: 'magic-link', actionLink })
}

/**
 * Confirms a password change that has already happened.
 *
 * Replaces Supabase's own `password_changed` notification, which is disabled so
 * the two can't both land. Every path that changes a password is responsible for
 * calling this — see `supabase/config.toml`.
 */
export async function sendPasswordChangedEmail(to: string): Promise<void> {
  await deliver(to, { kind: 'password-changed' })
}

/**
 * Throws if deployed mail is misconfigured.
 *
 * Callers run this *outside* the catch that keeps unknown addresses
 * indistinguishable from known ones. A missing API key is an operator error, not
 * a fact about the recipient, and absorbing it into the "if an account exists"
 * path is how a broken mailer masquerades as a delivered message.
 */
export function assertAuthEmailConfigured(): void {
  resolveMailConfig()
}

async function deliver(to: string, auth: AuthEmail): Promise<void> {
  const { from, transport } = resolveMailConfig()
  const business = await getBusiness()
  // Same rule as the internal portal: the Business page's addresses win, and
  // with no inbox email set, replies go back to the sending address.
  const sender = business.sendingEmail ?? from
  const replyTo = business.inboxEmail ?? sender
  const email = renderAuthEmail(
    auth,
    'client',
    replyTo,
    emailBrandFor(business)
  )

  await sendEmail(
    {
      from: formatSender(business.name, sender),
      to,
      replyTo,
      subject: email.subject,
      text: email.text,
      html: email.html,
    },
    transport
  )
}

/** Stand-ins for local mail. Mailpit accepts anything; nothing is delivered. */
const LOCAL_FROM = 'portal@localhost'

type MailConfig = {
  from: string
  transport: TransportConfig
}

/**
 * Deployed mail comes from the same sender the invite already uses, so every
 * message from us builds one domain's reputation rather than splitting it.
 *
 * The sender alone does not keep mail out of phishing filters: Supabase's stock
 * template (a bare link, near-zero prose, generic copy) gets flagged from this
 * same address. Hence the templates in `@pts/email`.
 *
 * Local mail goes to Mailpit, which delivers nothing and validates no sender, so
 * requiring real Resend credentials to reach it only makes the flow untestable.
 * Defaults keep `npm run dev` working in a checkout with no mail configuration.
 */
function resolveMailConfig(): MailConfig {
  const env = getEnv()

  if (process.env.NODE_ENV !== 'production') {
    return {
      from: env.RESEND_FROM_EMAIL ?? LOCAL_FROM,
      transport: { mode: 'mailpit' },
    }
  }

  const missing = [
    ['RESEND_API_KEY', env.RESEND_API_KEY],
    ['RESEND_FROM_EMAIL', env.RESEND_FROM_EMAIL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(
      `Cannot send portal auth email: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set.`
    )
  }

  return {
    from: env.RESEND_FROM_EMAIL!,
    transport: { mode: 'resend', apiKey: env.RESEND_API_KEY! },
  }
}
