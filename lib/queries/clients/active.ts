import { asc, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

type ActiveClient = {
  id: string
  name: string
  billingType: typeof clients.$inferSelect.billingType
}

export async function fetchActiveClients(): Promise<ActiveClient[]> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      billingType: clients.billingType,
    })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))
}
