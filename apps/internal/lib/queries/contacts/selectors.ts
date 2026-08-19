import { contacts } from '@/lib/db/schema'

export type SelectContact = typeof contacts.$inferSelect

export const contactFields = {
  id: contacts.id,
  email: contacts.email,
  name: contacts.name,
  phone: contacts.phone,
  createdBy: contacts.createdBy,
  userId: contacts.userId,
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
  deletedAt: contacts.deletedAt,
}
