import { contacts } from '@/lib/db/schema'

export type SelectContact = typeof contacts.$inferSelect

export const contactFields = {
  id: contacts.id,
  email: contacts.email,
  name: contacts.name,
  phone: contacts.phone,
  createdBy: contacts.createdBy,
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
  deletedAt: contacts.deletedAt,
}

export const contactGroupByColumns = [
  contacts.id,
  contacts.email,
  contacts.name,
  contacts.phone,
  contacts.createdBy,
  contacts.createdAt,
  contacts.updatedAt,
  contacts.deletedAt,
] as const
