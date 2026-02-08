import 'server-only'

import { sql } from 'drizzle-orm'

import type { DbClient } from '@/lib/db'

/**
 * Generate the next invoice number using the PostgreSQL sequence.
 * Format: {prefix}-{year}-{seq padded to 4+ digits}
 * Example: PTS-2026-0001
 */
export async function generateInvoiceNumber(
  db: DbClient,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear()
  const result = await db.execute<{ nextval: string }>(
    sql`SELECT nextval('invoice_number_seq')::text`
  )
  const seq = (result[0] as { nextval: string } | undefined)?.nextval ?? '1'
  return `${prefix}-${year}-${seq.padStart(4, '0')}`
}
