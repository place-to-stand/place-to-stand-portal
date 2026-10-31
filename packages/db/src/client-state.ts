import { sql, type SQL } from 'drizzle-orm'

import { companies } from './schema'

/**
 * Client state, in one place. Every read goes through a SQL function that
 * takes the company id (0113), never an inline subquery: drizzle may write
 * the outer column unqualified, which inside a subquery would bind to the
 * subquery's own `id`.
 * A client is a company you bill: billing lives in
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
  sql`company_was_client(${companies.id})`

/** A company billed in the month of `month` (any date in it). */
export const billedInMonth = (month: string): SQL =>
  sql`company_billed_in(${companies.id}, ${month}::date)`

/** The first month it was billed; null for a company never billed. */
export const clientSinceSql = sql<
  string | null
>`company_client_since(${companies.id})::text`

/**
 * When it stopped being a client: the month after billing last ended, or
 * when it was archived. Null while it is a client, and for a company never
 * billed and not archived.
 */
export const clientEndedAtSql = sql<
  string | null
>`coalesce(company_billing_ended_at(${companies.id}), case when company_is_client(${companies.id}) then null else ${companies.deletedAt} end)`

/** True for a company billed before but not now. */
export const isFormerClientSql = sql<boolean>`(${wasClientCompany()} and not company_is_client(${companies.id}))`

/**
 * The last month billed when a stop is scheduled ("bill through the end of
 * this month"): the latest stretch's end while billing is still open. Null
 * while billing runs on, and for a company not billed now.
 */
export const billingEndsOnSql = sql<
  string | null
>`company_billing_ends_on(${companies.id})::text`

/**
 * True when the company (by table alias) is active: not archived, and not a
 * former client (billing stopped). Memberships at inactive companies stay in
 * the database as history but are hidden from active views (lists, counts,
 * main company, CLI/MCP). The alias is written raw, so pass only a literal.
 */
export const activeCompanySql = (alias: string): SQL =>
  sql.raw(
    `(${alias}.deleted_at is null and (company_billing_open(${alias}.id) or not company_was_client(${alias}.id)))`
  )
