/**
 * Shared by the company and person sheets and the server's refusals, so the
 * disabled control and the refused save say the same thing. Client-safe.
 */

/** A client's primary contact is its invoice recipient: admins change it. */
export const CLIENT_PRIMARY_ADMIN_ONLY =
  'Only an admin can change a client’s primary contact.'

/** Someone who can sign in sees what their companies give them. */
export const SIGN_IN_COMPANIES_ADMIN_ONLY =
  'Only an admin can change the companies of someone who can sign in.'
