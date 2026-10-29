import 'server-only'

import { asc, eq, isNull, sql } from 'drizzle-orm'

import { assertCrmAccess } from '@/lib/auth/permissions'
import type { AppUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { companies, contacts } from '@/lib/db/schema'

export type ContactOption = {
  id: string
  name: string
  email: string | null
  phone: string | null
  companyId: string | null
  companyName: string | null
}

/** Live contacts for the contact pickers (lead sheet), A–Z. */
export async function listContactOptions(user: AppUser): Promise<ContactOption[]> {
  assertCrmAccess(user)

  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      companyId: contacts.companyId,
      companyName: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .where(isNull(contacts.deletedAt))
    .orderBy(asc(sql`lower(${contacts.name})`))
}
