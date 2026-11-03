import { currentBillingTypeSql } from '@pts/db/terms'
import { clientEndedAtSql, wasClientCompany } from '@pts/db/client-state'
import 'server-only'

import { asc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'

/** A company that is or was a client, as every client picker lists it. */
export type ClientDirectoryRow = {
  id: string
  name: string
  slug: string | null
  state: string | null
  /** The newest terms' billing type. */
  billingType: string
  /** When billing ended (null: billed now). */
  deletedAt: string | null
}

/**
 * Every company that is or was a client, by name: the one list behind the
 * project, invoice, hour block and time log client pickers. Former clients
 * are included so a record's own (now ended) client still shows. Callers
 * check permissions first.
 */
export async function listClientDirectory(): Promise<ClientDirectoryRow[]> {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      state: companies.state,
      billingType: currentBillingTypeSql(),
      deletedAt: clientEndedAtSql,
    })
    .from(companies)
    .where(wasClientCompany())
    .orderBy(asc(companies.name))
}

/**
 * Whether any company is or was a client: the create buttons' disabled
 * state, without loading the whole directory. Callers check permissions
 * first.
 */
export async function hasClientDirectory(): Promise<boolean> {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(wasClientCompany())
    .limit(1)
  return rows.length > 0
}
