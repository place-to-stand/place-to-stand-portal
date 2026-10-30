import { wasClientCompany, clientEndedAtSql } from '@pts/db/client-state'
import { clientNameSql } from '@pts/db/names'
import 'server-only'

import { asc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies, } from '@/lib/db/schema'

/**
 * Fetches all clients (including archived) for the project sheet dropdown.
 * Admin-only — needed so newly created clients appear even before they have projects.
 */
export async function fetchClientDirectory(): Promise<
  Array<{ id: string; name: string; deletedAt: string | null }>
> {
  return db
    .select({
      id: companies.id,
      name: clientNameSql,
      deletedAt: clientEndedAtSql,
    })
    .from(companies).where(wasClientCompany())
    .orderBy(asc(clientNameSql))
}

