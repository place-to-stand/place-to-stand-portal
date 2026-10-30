import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

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

/**
 * The photo behind a sign-in: the person's (contacts.avatar_url), falling
 * back to the sign-in's own copy for anyone not yet linked to a person.
 */
export async function getUserAvatarPath(userId: string): Promise<string> {
  const [row] = await db
    .select({
      personAvatar: contacts.avatarUrl,
      userAvatar: users.avatarUrl,
    })
    .from(users)
    .leftJoin(
      contacts,
      and(eq(contacts.userId, users.id), isNull(contacts.deletedAt))
    )
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  const path = row?.personAvatar ?? row?.userAvatar
  if (!path) throw new NotFoundError('Avatar not found')
  return path
}
