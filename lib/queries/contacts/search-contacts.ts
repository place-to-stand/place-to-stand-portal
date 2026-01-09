'use server'

import { and, isNull, ilike, or, sql, type SQL } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'

export type SearchContactResult = {
  id: string
  email: string
  name: string
  phone: string | null
}

export async function searchContacts(
  user: AppUser,
  query: string = '',
  limit: number = 50
): Promise<SearchContactResult[]> {
  assertAdmin(user)

  const conditions: SQL[] = [isNull(contacts.deletedAt)]

  if (query.trim()) {
    const searchTerm = `%${query.trim()}%`
    conditions.push(
      or(
        ilike(contacts.name, searchTerm),
        ilike(contacts.email, searchTerm),
        ilike(contacts.phone, searchTerm)
      ) ?? sql`true`
    )
  }

  const results = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      phone: contacts.phone,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(contacts.name)
    .limit(limit)

  return results
}
