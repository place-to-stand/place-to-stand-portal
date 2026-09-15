import 'server-only'

import { createDb } from '@pts/db/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

declare global {
  var __drizzle_db__: ReturnType<typeof createDb> | undefined
}

// One client per process. The previous lazy Proxy re-created the pool on
// every property access in production (it only memoised outside production),
// so each query on Vercel opened a fresh TLS connection to the pooler — that
// alone put page loads over a second. Mirrors apps/internal/lib/db/index.ts.
export const db = globalThis.__drizzle_db__ ?? createDb(databaseUrl)

if (process.env.NODE_ENV !== 'production') {
  globalThis.__drizzle_db__ = db
}
