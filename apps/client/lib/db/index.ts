import 'server-only'

import { createDb } from '@pts/db/client'

type Db = ReturnType<typeof createDb>

declare global {
  var __drizzle_db__: Db | undefined
}

// Module-level memo: one client per process in every environment. The old
// version memoised only outside production (via globalThis), so on Vercel
// every `db.` access built a fresh postgres.js pool and opened a new TLS
// connection to the pooler — that alone put page loads over a second.
let _db: Db | undefined

function getDb(): Db {
  if (_db) return _db

  // Dev HMR re-evaluates this module; reuse the pool across reloads.
  if (process.env.NODE_ENV !== 'production' && globalThis.__drizzle_db__) {
    _db = globalThis.__drizzle_db__
    return _db
  }

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

// Still lazy: the client is created on first property access, not at import
// time, because Vercel's build step collects route config without
// DATABASE_URL and would otherwise fail on `import { db }`.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
