import {
  DEFAULT_EMAIL_BRAND,
  formatExpiryWindow,
  renderEmail,
  type EmailBrand,
  type RenderedEmail,
} from '../layout'

export type MagicLinkEmailArgs = {
  /** One-time link from `admin.generateLink({ type: 'magiclink' })`. */
  actionLink: string
  /** Where the link lands, in words — "the client portal". */
  destination: string
  /** Mirrors Supabase's `otp_expiry`, so the copy can't promise the wrong window. */
  expiresInMinutes: number
  replyTo: string
  /** Sender identity; Place To Stand when left out. */
  brand?: EmailBrand
}

export function magicLinkEmail({
  actionLink,
  destination,
  expiresInMinutes,
  replyTo,
  brand = DEFAULT_EMAIL_BRAND,
}: MagicLinkEmailArgs): RenderedEmail {
  return renderEmail(`Your ${brand.name} sign-in link`, {
    preheader: `Sign in to ${destination} — no password needed.`,
    label: 'Sign-in link',
    heading: `Sign in to ${brand.name}`,
    paragraphs: [
      `Here's the sign-in link you asked for. It takes you straight into ${destination} — no password needed.`,
      "If you didn't ask for this, you can ignore it. The link only works from this message, and nobody can sign in without it.",
    ],
    action: {
      label: 'Sign in',
      url: actionLink,
    },
    note: `This link works once and expires in ${formatExpiryWindow(expiresInMinutes)}. You can always request a fresh one from the sign-in page.`,
    replyTo,
    brand,
  })
}
