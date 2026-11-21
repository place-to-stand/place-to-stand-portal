#!/usr/bin/env node
/**
 * A merge to main deploys production at once, so a pull request that adds or
 * changes a migration can't pass until production has it:
 *
 *   node scripts/pr-checks/prod-migration.mjs <base sha> <head sha>
 *
 * with the PR description in PR_BODY. Run `npm run db:migrate:prod` from
 * packages/db, confirm it exits 0, then add the line `Prod migration: done`
 * to the description. Editing the description re-runs this check.
 */
import { bodyHasLine, changedFiles, isMain, readRange } from './shared.mjs'

const MIGRATION = /^packages\/db\/drizzle\/migrations\/[^/]+\.sql$/
const DONE = 'Prod migration: done'

export function checkProdMigration({ files, body }) {
  const migrations = files.filter(file => MIGRATION.test(file))
  if (migrations.length === 0) return { ok: true, why: 'no migrations' }
  if (bodyHasLine(body, DONE)) return { ok: true, why: DONE, migrations }
  return { ok: false, migrations }
}

function main() {
  const { base, head } = readRange('prod-migration.mjs')
  // Added or changed, not deleted: a deleted file has nothing to run.
  const files = changedFiles(base, head, 'AM')
  const result = checkProdMigration({ files, body: process.env.PR_BODY })
  if (result.ok) {
    console.log(`Prod migration check passed: ${result.why}.`)
    return
  }
  console.error(
    [
      'This pull request adds or changes a migration. Merging deploys',
      'production at once, so production needs the migration first:',
      '',
      '  1. From packages/db, run `npm run db:migrate:prod` and confirm it exits 0.',
      '  2. Add this line to the pull request description:',
      `       ${DONE}`,
      '',
      'Migrations:',
      ...result.migrations.map(file => `  ${file}`),
    ].join('\n')
  )
  process.exit(1)
}

if (isMain(import.meta.url)) main()
