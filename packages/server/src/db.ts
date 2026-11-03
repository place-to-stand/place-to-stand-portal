import 'server-only'

import { createDb } from '@pts/db/client'

type Db = ReturnType<typeof createDb>

declare global {
  var __drizzle_db__: Db | undefined
}

// Module-level memo: one client per process in every environment. Memoising
// only outside production (via globalThis) meant that on Vercel every `db.`
// access built a fresh postgres.js pool and a new TLS connection to the
// pooler, which alone put page loads over a second.
let _db: Db | undefined

function getDb(): Db {
  if (_db) return _db

  // Dev HMR re-evaluates this module; reuse the pool across reloads.
  if (process.env.NODE_ENV !== 'production' && globalThis.__drizzle_db__) {
    _db = globalThis.__drizzle_db__
    return _db
  }

  // Read directly: scripts and drizzle tooling import the db without the
  // rest of an app's env.
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  _db = createDb(databaseUrl)

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__drizzle_db__ = _db
  }

  return _db
}

// Lazy: the client is created on first property access, not at import time,
// because Vercel's build step collects route config without DATABASE_URL and
// would otherwise fail on `import { db }`.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

/** The transaction handle `db.transaction` passes to its callback. */
export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0]

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
