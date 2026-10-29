import 'server-only'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { clients, companies, contactClients, contacts } from '@/lib/db/schema'
import { ForbiddenError } from '@/lib/errors/http'

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
 * the client sheet. The contact must work at that company (one with no
 * company on record joins it). Clearing only clears it when the current
 * primary was one of this client's contacts before or after the change, so
 * a client can't unset someone it never showed.
 */
export async function setClientPrimaryContact(
  clientId: string,
  primaryContactId: string | null,
  /** The client's contact ids before and after this save. */
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
    const [contact] = await db
      .select({ companyId: contacts.companyId })
      .from(contacts)
      .where(eq(contacts.id, primaryContactId))
      .limit(1)
    if (contact?.companyId && contact.companyId !== companyId) {
      throw new ForbiddenError(
        'That contact works at another company, so they can’t be this client’s primary contact.'
      )
    }
    await db.transaction(async tx => {
      await tx
        .update(companies)
        .set({ primaryContactId, updatedAt: sql`timezone('utc'::text, now())` })
        .where(eq(companies.id, companyId))
      if (!contact?.companyId) {
        await tx
          .update(contacts)
          .set({ companyId })
          .where(eq(contacts.id, primaryContactId))
      }
    })
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
