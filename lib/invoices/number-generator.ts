import 'server-only'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

/**
 * Generate the next invoice number using the PG SEQUENCE.
 * Format: PREFIX-YYYY-NNNN
 *
 * Note: The sequence `invoice_number_seq` must be created via migration.
 * If it doesn't exist yet, this falls back to a timestamp-based approach.
 */
export async function generateNextInvoiceNumber(
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear()

  try {
    const result = await db.execute(
      sql`SELECT nextval('invoice_number_seq') as next_val`
    )
    const nextVal = Number(
      (result as unknown as Array<Record<string, unknown>>)[0]?.next_val
    )
    return `${prefix}-${year}-${String(nextVal).padStart(4, '0')}`
  } catch {
    // Fallback: use timestamp-based number if sequence doesn't exist yet
    const ts = Date.now().toString().slice(-6)
    return `${prefix}-${year}-${ts}`
  }
}
