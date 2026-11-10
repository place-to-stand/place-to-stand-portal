import 'server-only'

import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm'

import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

/** A person's photo path (contacts.avatar_url). */
export async function getPersonAvatarPath(contactId: string): Promise<string> {
  const [row] = await db
    .select({ avatarUrl: contacts.avatarUrl })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1)

  if (!row?.avatarUrl) throw new NotFoundError('Avatar not found')
  return row.avatarUrl
}

/** The photo behind a sign-in: its person's (contacts.avatar_url). */
export async function getUserAvatarPath(userId: string): Promise<string> {
  const [row] = await db
    .select({ avatarUrl: contacts.avatarUrl })
    .from(users)
    .innerJoin(
      contacts,
      and(eq(contacts.userId, users.id), isNull(contacts.deletedAt))
    )
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  if (!row?.avatarUrl) throw new NotFoundError('Avatar not found')
  return row.avatarUrl
}

/**
 * Staff with a photo: the people whose avatars fill most screens, so the
 * dashboard warms them into the browser cache up front.
 */
export async function listStaffWithPhotos(): Promise<
  { userId: string; contactId: string }[]
> {
  return db
    .select({ userId: users.id, contactId: contacts.id })
    .from(users)
    .innerJoin(
      contacts,
      and(eq(contacts.userId, users.id), isNull(contacts.deletedAt))
    )
    .where(
      and(
        isNull(users.deletedAt),
        ne(users.role, 'CLIENT'),
        isNotNull(contacts.avatarUrl)
      )
    )
}
