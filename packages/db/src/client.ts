import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 20,
    idle_timeout: 20,
  })

  return drizzle(client)
}

export type DbClient = ReturnType<typeof createDb>
