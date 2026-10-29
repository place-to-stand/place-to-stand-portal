import 'server-only'

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, companies, contactClients, contacts } from '@/lib/db/schema'

/**
 * A client's primary contact is its company's primary contact. For a row of
 * `contact_clients` joined to `contacts`, true when that contact is the
 * primary one for the row's client.
 */
export const isClientPrimaryContactSql = sql<boolean>`coalesce(${contacts.id} = (
  select co.primary_contact_id
  from ${clients} cl
  join ${companies} co on co.id = cl.company_id
  where cl.id = ${contactClients.clientId}
), false)`

/**
 * Sets (or, with null, clears) the primary contact of a client's company from
 * the client sheet. Clearing only clears it when the current primary is one
 * of this client's linked contacts, so a client can't unset someone it
 * doesn't show. A contact without a company joins this one.
 */
export async function setClientPrimaryContact(
  clientId: string,
  primaryContactId: string | null,
  linkedContactIds: readonly string[]
) {
  const [client] = await db
    .select({ companyId: clients.companyId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1)
  const companyId = client?.companyId
  if (!companyId) return

  if (primaryContactId) {
    await db
      .update(companies)
      .set({ primaryContactId, updatedAt: sql`timezone('utc'::text, now())` })
      .where(eq(companies.id, companyId))
    await db
      .update(contacts)
      .set({ companyId })
      .where(and(eq(contacts.id, primaryContactId), isNull(contacts.companyId)))
    return
  }

  if (linkedContactIds.length === 0) return
  await db
    .update(companies)
    .set({ primaryContactId: null, updatedAt: sql`timezone('utc'::text, now())` })
    .where(
      and(
        eq(companies.id, companyId),
        inArray(companies.primaryContactId, [...linkedContactIds])
      )
    )
}
