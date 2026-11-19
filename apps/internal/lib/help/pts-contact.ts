/**
 * Who built the portal, in the Get help dialog (user menu, ⌘K). A constant on purpose, not a
 * Business setting: every install shows it unchanged, and a change here
 * reaches every install with its next update.
 */
export const PTS_CONTACT = {
  name: 'Place To Stand Agency',
  email: 'hello@placetostandagency.com',
  website: 'https://placetostandagency.com',
  /** The site's contact page: book a call or send a message. */
  bookingUrl: 'https://placetostandagency.com/contact',
} as const
