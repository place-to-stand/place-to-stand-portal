// Applies pending migrations to DATABASE_URL and prints the real error if one
// fails (drizzle-kit migrate hides it). drizzle runs the whole batch in one
// transaction, so a failure changes nothing. Never prints the connection string.
//
// Usage: node scripts/migrate.mjs [env file]. With a file (as
// `npm run db:migrate:prod` passes apps/internal/.env.prod), its DATABASE_URL
// wins over one already in the shell, so a prod run can't hit another database.
// Works through Supabase's pooler: the
// `pgbouncer=true` flag is Prisma's, not Postgres's, so it is dropped, and
// prepared statements are off.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { config } from 'dotenv'
import postgres from 'postgres'

const envFile = process.argv[2]
if (envFile) {
  const loaded = config({ path: envFile, override: true, quiet: true })
  if (loaded.error) {
    console.error(`Could not read ${envFile}`)
    process.exit(1)
  }
}

const raw = process.env.DATABASE_URL
if (!raw) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const url = raw.replace(/([?&])pgbouncer=true&?/, '$1').replace(/[?&]$/, '')
const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../drizzle/migrations'
)
const redact = text =>
  String(text).replace(/postgres(ql)?:\/\/\S+/g, '<redacted>')

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
let exitCode = 0
try {
  await migrate(drizzle(sql), {
    migrationsFolder,
    migrationsTable: '__drizzle_migrations',
    migrationsSchema: 'drizzle',
  })
  const [row] =
    await sql`select count(*)::int as n from drizzle.__drizzle_migrations`
  process.stdout.write(
    `Migrations applied. Rows in drizzle.__drizzle_migrations: ${row.n}\n`
  )
} catch (error) {
  const cause = error?.cause ?? error
  console.error(
    'Migration failed; nothing changed (one transaction):',
    cause?.code ?? '',
    redact(cause?.message ?? error).slice(0, 500)
  )
  if (cause?.where) console.error('where:', redact(cause.where).slice(0, 300))
  exitCode = 1
} finally {
  await sql.end()
}
process.exit(exitCode)
