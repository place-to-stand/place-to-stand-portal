import { contacts } from '@/lib/db/schema'
import {
  mainCompanyIdSql,
  mainCompanyNameSql,
  mainTitleSql,
} from '@/lib/queries/memberships'

export type SelectContact = typeof contacts.$inferSelect

export const contactFields = {
  id: contacts.id,
  email: contacts.email,
  name: contacts.name,
  phone: contacts.phone,
  avatarUrl: contacts.avatarUrl,
  createdBy: contacts.createdBy,
  userId: contacts.userId,
  createdAt: contacts.createdAt,
  updatedAt: contacts.updatedAt,
  deletedAt: contacts.deletedAt,
}

/**
 * Sales profile fields a contact carries beyond its identity. Company and
 * title are their main company's (oldest current membership); the full list
 * is `listContactMemberships`.
 */
export type ContactProfile = {
  jobTitle: string | null
  linkedinUrl: string | null
  companyId: string | null
  /** Main company's name. */
  companyName: string | null
}

/**
 * Select fragment for `ContactProfile`: correlated subqueries, so every
 * select on `contacts` can spread it without adding a join.
 */
export const contactProfileFields = {
  jobTitle: mainTitleSql(contacts.id),
  linkedinUrl: contacts.linkedinUrl,
  companyId: mainCompanyIdSql(contacts.id),
  companyName: mainCompanyNameSql(contacts.id),
}
