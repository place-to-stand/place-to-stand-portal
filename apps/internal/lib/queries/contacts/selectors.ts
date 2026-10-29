import { sql } from 'drizzle-orm'

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

/** Sales profile fields a contact carries beyond its identity. */
export type ContactProfile = {
  jobTitle: string | null
  linkedinUrl: string | null
  isChampion: boolean
  companyId: string | null
  /**
   * Linked company's name, archived companies included, so an edit that
   * leaves the field alone keeps the link.
   */
  companyName: string | null
}

/**
 * Select fragment for `ContactProfile`. The company name is a correlated
 * subquery on the raw column name, so every select on `contacts` can spread
 * it without adding a join.
 */
export const contactProfileFields = {
  jobTitle: contacts.jobTitle,
  linkedinUrl: contacts.linkedinUrl,
  isChampion: contacts.isChampion,
  companyId: contacts.companyId,
  companyName: sql<string | null>`(
    select co.name from companies co
    where co.id = contacts.company_id
  )`,
}
