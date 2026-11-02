import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { contacts, users } from '@/lib/db/schema'

export async function softDeleteUser(
  user: AppUser,
  userId: string,
): Promise<string> {
  assertAdmin(user)

  const deletedAt = new Date().toISOString()

  await db.transaction(async tx => {
    await tx.update(users).set({ deletedAt }).where(eq(users.id, userId))
    // Their sign-in shows on the person sheet: one loaded before this must
    // not save over it.
    await tx
      .update(contacts)
      .set({ updatedAt: deletedAt })
      .where(and(eq(contacts.userId, userId), isNull(contacts.deletedAt)))
  })

  return deletedAt
}

export async function restoreUser(user: AppUser, userId: string) {
  assertAdmin(user)

  await db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.id, userId))
}

