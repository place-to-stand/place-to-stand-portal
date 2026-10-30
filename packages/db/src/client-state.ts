import { sql, type SQL } from 'drizzle-orm'

import { companies } from './schema'

/**
 * Client state, in one place. A client is a company you bill: billing lives in
 * `client_billing_periods` (one row per stretch of billing, by month), read
 * through two SQL functions defined in migration 0113 that the portal view
 * also uses:
 *
 * - `company_billing_open(id)`: billing hasn't ended (it runs this month, or
 *   a restart is scheduled), archived or not.
 * - `company_is_client(id)`: billing open and the company isn't archived.
 * - `company_billed_in(id, month)`: a billing period covers that month; the
 *   monthly close counts a client in exactly those months.
 *
 * Never read the periods table directly for "is this a client".
 */

/** A company billed now (or about to be), and not archived. */
export const isClientCompany = (): SQL =>
  sql`company_is_client(${companies.id})`

/** Billing hasn't ended, whether or not the company is archived. */
export const billingOpenSql = (): SQL =>
  sql`company_billing_open(${companies.id})`

/** A company ever billed: a client or a former client. */
export const wasClientCompany = (): SQL =>
  sql`exists (select 1 from client_billing_periods cbp where cbp.company_id = ${companies.id} and cbp.deleted_at is null)`

/** A company billed in the month of `month` (any date in it). */
export const billedInMonth = (month: string): SQL =>
  sql`company_billed_in(${companies.id}, ${month}::date)`

/** The first month it was billed; null for a company never billed. */
export const clientSinceSql = sql<
  string | null
>`(select min(cbp.starts_on)::text from client_billing_periods cbp where cbp.company_id = ${companies.id} and cbp.deleted_at is null)`

/**
 * When it stopped being a client: the month after billing last ended, or
 * when it was archived. Null while it is a client, and for a company never
 * billed and not archived.
 */
export const clientEndedAtSql = sql<string | null>`(case
  when company_is_client(${companies.id}) then null
  else coalesce(
    (select (max(cbp.ends_on) + interval '1 month')::timestamptz::text
       from client_billing_periods cbp
       where cbp.company_id = ${companies.id} and cbp.deleted_at is null
       having bool_and(cbp.ends_on is not null)),
    ${companies.deletedAt})
end)`

/** True for a company billed before but not now. */
export const isFormerClientSql = sql<boolean>`(${wasClientCompany()} and not company_is_client(${companies.id}))`
