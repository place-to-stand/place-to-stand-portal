import { and, isNotNull, isNull, sql } from 'drizzle-orm'

import { companies } from './schema'

/**
 * A client is a company you bill (0111 folded the clients table into
 * `companies`): `client_since` is set and `client_ended_at` is not.
 */

/** A company billed now (and not archived). */
export const isClientCompany = () =>
  and(
    isNotNull(companies.clientSince),
    isNull(companies.clientEndedAt),
    isNull(companies.deletedAt)
  )!

/** A company billed now or before (a client or a former client). */
export const wasClientCompany = () => isNotNull(companies.clientSince)

/** When billing stopped, or the company was archived: the old "deleted". */
export const clientEndedAtSql = sql<
  string | null
>`coalesce(${companies.clientEndedAt}, ${companies.deletedAt})`
