import 'server-only'

import { sql } from 'drizzle-orm'

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
