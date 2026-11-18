import {
  DEFAULT_EMAIL_BRAND,
  renderEmail,
  type EmailBrand,
  type RenderedEmail,
} from '../layout'

export type AdminInviteEmailArgs = {
  /** The address the account was created with — repeated in the body. */
  email: string
  fullName?: string | null
  temporaryPassword: string
  /** The internal portal's sign-in page — never the client portal. */
  signInUrl: string
  replyTo: string
  /** Sender identity; Place To Stand when left out. */
  brand?: EmailBrand
}

/**
 * Admin invite.
 *
 * Admins get a temporary password and are forced through a password reset on
 * first sign-in. Kept separate from the client invite so neither carries a
 * field the other ignores.
 */
export function adminInviteEmail({
  email,
  fullName,
  temporaryPassword,
  signInUrl,
  replyTo,
  brand = DEFAULT_EMAIL_BRAND,
}: AdminInviteEmailArgs): RenderedEmail {
  const greeting = fullName?.trim() ? `Hi ${fullName.trim()}, you've` : "You've"

  return renderEmail(`You're invited to the ${brand.name} portal`, {
    preheader: `Your sign-in details for the ${brand.name} internal portal.`,
    label: 'Internal portal',
    heading: "You've been given access",
    paragraphs: [
      `${greeting} been given access to the ${brand.name} internal portal. Sign in with the details below.`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      "For security, you'll be asked to create a new password the first time you sign in.",
    ],
    action: {
      label: 'Sign in to the portal',
      url: signInUrl,
    },
    replyTo,
    brand,
  })
}
