import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'

/** The live person behind a sign-in, or null. */
export async function findContactIdForUser(
  userId: string
): Promise<string | null> {
  const [person] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
    .limit(1)
  return person?.id ?? null
}
