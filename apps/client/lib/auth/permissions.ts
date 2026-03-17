import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clientMembers } from '@pts/db/schema'
import type { AppUser } from '@/lib/auth/session'
import { ForbiddenError } from '@/lib/errors/http'

export function isAdmin(user: AppUser | null | undefined): boolean {
  return !!user && user.role === 'ADMIN'
}

/**
 * Verify user has access to a specific client.
 * In the client portal, users must be a member of the client.
 */
export async function ensureClientAccess(user: AppUser, clientId: string) {
  if (isAdmin(user)) {
    return
  }

  const [membership] = await db
    .select({ id: clientMembers.id })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.clientId, clientId),
        eq(clientMembers.userId, user.id),
        isNull(clientMembers.deletedAt)
      )
    )
    .limit(1)

  if (!membership) {
    throw new ForbiddenError('You do not have access to this client')
  }
}

/**
 * Get all client IDs accessible to a user.
 */
export async function listAccessibleClientIds(
  user: AppUser
): Promise<string[]> {
  if (isAdmin(user)) {
    // Admins could see all, but in client portal context, return empty
    // since admin-specific views are in the internal app
    return []
  }

  const memberships = await db
    .select({ clientId: clientMembers.clientId })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.userId, user.id),
        isNull(clientMembers.deletedAt)
      )
    )

  return memberships.map(m => m.clientId)
}
