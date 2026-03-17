'use server'

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
      name: clients.name,
      slug: clients.slug,
    })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))
}
