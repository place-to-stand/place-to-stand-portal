import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { asc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

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
      name: clientNameSql,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .orderBy(asc(clientNameSql))
}

