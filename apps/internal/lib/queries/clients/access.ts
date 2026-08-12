'use server'

import { and, asc, eq, isNull } from 'drizzle-orm'

import type { AppUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors/http'

import { clientFields, type SelectClient } from './selectors'

export async function listClientsForUser(
  user: AppUser,
): Promise<SelectClient[]> {
  assertAdmin(user)

  return db
    .select(clientFields)
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))
}

/**
 * Fetches all clients (including archived) for the project sheet dropdown.
 * Admin-only — needed so newly created clients appear even before they have projects.
 */
export async function fetchClientDirectory(): Promise<
  Array<{ id: string; name: string; deletedAt: string | null }>
> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .orderBy(asc(clients.name))
}

export async function getClientById(
  user: AppUser,
  clientId: string,
): Promise<SelectClient> {
  assertAdmin(user)

  const result = await db
    .select(clientFields)
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1)

  if (!result.length) {
    throw new NotFoundError('Client not found')
  }

  return result[0]
}

/**
 * By-id fetch that keeps archived clients — the `?client=` deep-link resolver
 * needs the soft-deleted row so a shared link can cross-redirect to the
 * archive tab instead of reporting a dead link.
 */
export async function getClientByIdIncludingArchived(
  user: AppUser,
  clientId: string,
): Promise<SelectClient | null> {
  assertAdmin(user)

  const result = await db
    .select(clientFields)
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)

  return result[0] ?? null
}
