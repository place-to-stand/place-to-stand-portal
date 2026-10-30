'use server'

import { clientNameSql } from '@pts/db/names'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { UUID_PATTERN } from '@/lib/sheets/entities'

export type ClientOption = {
  id: string
  name: string
  slug: string | null
}

export async function fetchClientOptions(): Promise<ClientOption[]> {
  await requireRole('ADMIN')

  return db
    .select({
      id: clients.id,
      name: clientNameSql,
      slug: clients.slug,
    })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clientNameSql))
}

/** The company's live client, if it is one (Make client links to it). */
export async function fetchCompanyClient(
  companyId: string
): Promise<ClientOption | null> {
  await requireRole('ADMIN')
  if (!UUID_PATTERN.test(companyId)) return null

  const [row] = await db
    .select({ id: clients.id, name: clientNameSql, slug: clients.slug })
    .from(clients)
    .where(and(eq(clients.companyId, companyId), isNull(clients.deletedAt)))
    .limit(1)
  return row ?? null
}
