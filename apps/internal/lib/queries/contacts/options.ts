import 'server-only'

import { asc, isNull, sql } from 'drizzle-orm'

import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { mainCompanyIdSql, mainCompanyNameSql } from '@/lib/queries/memberships'

export type ContactOption = {
  id: string
  name: string
  email: string | null
  phone: string | null
  companyId: string | null
  companyName: string | null
}

/** Live contacts for the contact pickers (lead sheet), A–Z. */
export async function listContactOptions(
  user: AppUser
): Promise<ContactOption[]> {
  assertCrmAccess(user)

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      // Their main company (oldest current membership).
      companyId: mainCompanyIdSql(contacts.id),
      companyName: mainCompanyNameSql(contacts.id),
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(sql`lower(${contacts.name})`))
}
