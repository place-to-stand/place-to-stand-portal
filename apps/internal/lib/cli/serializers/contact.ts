import type { ContactsSettingsListItem } from '@/lib/queries/contacts/settings/types'

export type CliContact = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Set when the contact has been promoted to a portal user. */
  userId: string | null
  createdAt: string
  updatedAt: string
}

export function serializeContact(
  contact: ContactsSettingsListItem
): CliContact {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    userId: contact.userId,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  }
}
