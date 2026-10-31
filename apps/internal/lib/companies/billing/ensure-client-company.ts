import 'server-only'

import { and, eq } from 'drizzle-orm'

import { isClientCompany } from '@pts/db/client-state'

import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'

/**
 * Billed records (client projects, hour blocks, invoices) point at a company
 * you bill. Foreign keys only say "a company", so every save checks this.
 * Returns an error message, or null when the company is a client with a slug.
 */
export async function ensureClientCompany(
  companyId: string | null | undefined
): Promise<string | null> {
  if (!companyId) return 'Pick the client this belongs to.'
  const [row] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(and(eq(companies.id, companyId), isClientCompany()))
    .limit(1)
  if (!row) return 'That company isn’t a client: start its billing first.'
  if (!row.slug)
    return 'That client has no URL slug: set one on its Billing tab.'
  return null
}
