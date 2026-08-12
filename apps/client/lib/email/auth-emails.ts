import 'server-only'

import {
  magicLinkEmail,
  passwordResetEmail,
  sendEmail,
  type RenderedEmail,
  type TransportConfig,
} from '@pts/email'

import { getEnv } from '@/lib/env.server'

/**
 * Matches `otp_expiry` in `supabase/config.toml` (3600s). The templates state
 * the window in words, so a drift here makes the mail lie about how long the
 * recipient has.
 */
const LINK_EXPIRY_MINUTES = 60

/** How the portal refers to itself in mail. */
const DESTINATION = 'the Place To Stand client portal'

type AuthEmailTemplate = (args: {
  actionLink: string
  destination: string
  expiresInMinutes: number
  replyTo: string
}) => RenderedEmail

export async function sendPasswordResetEmail(
  to: string,
  actionLink: string
): Promise<void> {
  await send(to, actionLink, passwordResetEmail)
}

export async function sendMagicLinkEmail(
  to: string,
  actionLink: string
): Promise<void> {
  await send(to, actionLink, magicLinkEmail)
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

async function send(
  to: string,
  actionLink: string,
  template: AuthEmailTemplate
): Promise<void> {
  const { from, replyTo, transport } = resolveMailConfig()

  const email = template({
    actionLink,
    destination: DESTINATION,
    expiresInMinutes: LINK_EXPIRY_MINUTES,
    replyTo,
  })

  await sendEmail(
    {
      from: `Place To Stand <${from}>`,
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
const LOCAL_REPLY_TO = 'hello@placetostandagency.com'

type MailConfig = {
  from: string
  replyTo: string
  transport: TransportConfig
}

/**
 * Deployed mail comes from the same sender the invite already uses, so every
 * message from us builds one domain's reputation rather than splitting it.
 *
 * Sender was not what got Supabase's password reset flagged as phishing — that
 * mail came from the same address this does. It was the stock template: a bare
 * link, near-zero prose, and generic copy. Hence the templates in `@pts/email`.
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
      replyTo: env.RESEND_REPLY_TO_EMAIL ?? LOCAL_REPLY_TO,
      transport: { mode: 'mailpit' },
    }
  }

  const missing = [
    ['RESEND_API_KEY', env.RESEND_API_KEY],
    ['RESEND_FROM_EMAIL', env.RESEND_FROM_EMAIL],
    ['RESEND_REPLY_TO_EMAIL', env.RESEND_REPLY_TO_EMAIL],
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
    replyTo: env.RESEND_REPLY_TO_EMAIL!,
    transport: { mode: 'resend', apiKey: env.RESEND_API_KEY! },
  }
}
