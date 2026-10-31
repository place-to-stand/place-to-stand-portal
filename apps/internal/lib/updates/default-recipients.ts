import 'server-only'

import type { ClientContactRow } from '@/lib/queries/clients/contacts'

import type { StaffMember } from './staff'
import type { ClientUpdateRecipients } from './types'

/**
 * The client's primary contact and anyone with portal access, primary
 * first. Other people at the company are offered in the composer but not
 * pre-selected, so an update never goes to someone just because they work
 * there. A starting point, not a rule: the review step curates the list.
 */
export function recipientsFromContacts(
  contacts: ClientContactRow[],
  staff: StaffMember[],
  /** The sender — already gets the message in Sent, so not cc'd to themselves. */
  senderId: string
): ClientUpdateRecipients {
  const to = uniqueEmails(
    contacts
      .filter(contact => contact.isPrimary || contact.hasPortalAccess)
      .flatMap(contact => (contact.email ? [contact.email] : []))
  )
  const cc = uniqueEmails(
    staff.filter(member => member.id !== senderId).map(member => member.email)
  ).filter(email => !to.includes(email))

  return { to, cc }
}

function uniqueEmails(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const email = value.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

/**
 * Who the email opens to: the primary contact's first name, falling back to
 * the first linked contact, then to nothing (the body says "Hi there,").
 * Contacts are already ordered primary-first by `fetchContactsForClient`.
 */
export function greetingNameFromContacts(
  contacts: ClientContactRow[]
): string | null {
  const name = contacts[0]?.name.trim()
  if (!name) return null
  return name.split(/\s+/)[0] ?? null
}
