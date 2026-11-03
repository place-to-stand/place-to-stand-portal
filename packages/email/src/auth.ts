import type { RenderedEmail } from './layout'
import { magicLinkEmail } from './templates/magic-link'
import { passwordChangedEmail } from './templates/password-changed'
import { passwordResetEmail } from './templates/password-reset'

/**
 * Matches `otp_expiry` in `supabase/config.toml` (3600s). The templates state
 * the window in words, so a drift here makes the mail lie about how long the
 * recipient has.
 */
export const AUTH_LINK_EXPIRY_MINUTES = 60

/** How each portal is named in its sign-in mail. */
export const PORTAL_NAMES = {
  internal: 'the Place To Stand internal portal',
  client: 'the Place To Stand client portal',
} as const

export type PortalName = keyof typeof PORTAL_NAMES

export type AuthEmail =
  | { kind: 'password-reset' | 'magic-link'; actionLink: string }
  | { kind: 'password-changed' }

/**
 * The sign-in mail both portals send. Each app keeps its own delivery
 * (sender, transport); the words and the link window live here.
 */
export function renderAuthEmail(
  email: AuthEmail,
  portal: PortalName,
  replyTo: string
): RenderedEmail {
  const destination = PORTAL_NAMES[portal]
  if (email.kind === 'password-changed') {
    return passwordChangedEmail({ destination, replyTo })
  }
  const template =
    email.kind === 'password-reset' ? passwordResetEmail : magicLinkEmail
  return template({
    actionLink: email.actionLink,
    destination,
    expiresInMinutes: AUTH_LINK_EXPIRY_MINUTES,
    replyTo,
  })
}
