'use server'

import { clientNameSql } from '@pts/db/names'
import { asc, isNull } from 'drizzle-orm'

import { requireRole } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

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
