import {
  DEFAULT_EMAIL_BRAND,
  renderEmail,
  type EmailBrand,
  type RenderedEmail,
} from '../layout'

export type PasswordChangedEmailArgs = {
  /** Where the password now applies, in words — "the client portal". */
  destination: string
  replyTo: string
  /** Sender identity; Place To Stand when left out. */
  brand?: EmailBrand
}

/**
 * Sent after a password change has already taken effect.
 *
 * Stands in for Supabase's stock `password_changed` notification. It carries no
 * link on purpose: the one thing a recipient should do if this wasn't them is
 * write to a human, and a button in a message about a security event is the
 * shape of phishing.
 */
export function passwordChangedEmail({
  destination,
  replyTo,
  brand = DEFAULT_EMAIL_BRAND,
}: PasswordChangedEmailArgs): RenderedEmail {
  return renderEmail(`Your ${brand.name} password was changed`, {
    preheader: `The password for your account on ${destination} was just changed.`,
    label: 'Password changed',
    heading: 'Your password was changed',
    paragraphs: [
      `The password for your account on ${destination} was just changed. If that was you, there's nothing to do — use your new password the next time you sign in.`,
    ],
    footerLead: "If you didn't make this change, please contact us at",
    replyTo,
    brand,
  })
}
