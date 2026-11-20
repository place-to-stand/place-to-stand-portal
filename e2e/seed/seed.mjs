#!/usr/bin/env node
/**
 * Resets the LOCAL Supabase database and fills it with made-up data for
 * development and the browser tests: `npm run test:e2e:seed`.
 *
 * Wipes everything in the local database. Needs `supabase start` running and
 * psql on your PATH. Refuses any database that isn't on this machine.
 *
 * Sign-ins (password `localpass123`): ada@example.com and grace@example.com
 * (admins), miles@example.com (sales), and in the client portal
 * rosa@harborpine.example and nina@fieldnote.example (clients).
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts })

const status = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { cwd: root })
    .toString()
    .split('\n')
    .map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(match => [match[1], match[2]])
)
const dbUrl = status.DB_URL
const apiUrl = status.API_URL
const serviceKey = status.SERVICE_ROLE_KEY
for (const url of [dbUrl, apiUrl]) {
  const host = url ? new URL(url).hostname : ''
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Seed only runs against a local Supabase (got "${host}")`)
  }
}

console.log('Resetting the local database…')
run('npx', ['supabase', 'db', 'reset', '--local'])
run('npm', ['run', 'db:migrate'], {
  cwd: path.join(root, 'packages/db'),
  env: { ...process.env, DATABASE_URL: dbUrl },
})

console.log('Creating sign-ins…')
for (const email of [
  'ada@example.com',
  'grace@example.com',
  'miles@example.com',
  'rosa@harborpine.example',
  'nina@fieldnote.example',
]) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: 'localpass123',
      email_confirm: true,
    }),
  })
  if (!response.ok) {
    throw new Error(`Could not create ${email}: ${await response.text()}`)
  }
}

console.log('Loading made-up data…')
run('psql', [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'e2e/seed/seed.sql'])
console.log('Done. Sign in as ada@example.com / localpass123.')
