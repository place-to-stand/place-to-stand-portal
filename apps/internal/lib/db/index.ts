import 'server-only'

import { createDb } from '@pts/db/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

declare global {
  var __drizzle_db__: ReturnType<typeof createDb> | undefined
}

export const db = globalThis.__drizzle_db__ ?? createDb(databaseUrl)

/** The transaction handle `db.transaction` passes to its callback. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * The constraint a unique violation (23505) hit, or null for any other
 * error. drizzle-orm wraps the driver error with the PostgresError on
 * `cause`; postgres-js names the index `constraint_name`. A violation that
 * names no constraint reads as 'unknown'.
 */
export function uniqueViolation(error: unknown): string | null {
  const read = (value: unknown): string | null => {
    if (typeof value !== 'object' || value === null) return null
    const { code, constraint_name, constraint } = value as {
      code?: string
      constraint_name?: string
      constraint?: string
    }
    return code === '23505'
      ? (constraint_name ?? constraint ?? 'unknown')
      : null
  }
  return read(error) ?? read((error as { cause?: unknown } | null)?.cause)
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.__drizzle_db__ = db
}
