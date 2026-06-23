/**
 * One-off maintenance script: dedupe the internal "Sales" project.
 *
 * Historically, lead-task creation auto-created a phantom INTERNAL project named
 * "Sales Strategy" (slug `sales-strategy`). The real project is "Sales"
 * (slug `sales`). This script re-points any tasks attached to the phantom
 * project(s) onto the real "Sales" project, then soft-deletes the phantoms.
 *
 * Safe to run multiple times (idempotent):
 *   - If no phantom projects exist, it logs and exits without changes.
 *   - Re-pointing tasks is a no-op once they already live on the keeper.
 *   - Soft-deletes only touch rows where `deleted_at IS NULL`.
 *
 * Run (from apps/internal, with DATABASE_URL available):
 *   npx tsx scripts/dedupe-sales-project.ts
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'

import { createDb } from '@pts/db/client'
import { projects, tasks } from '@pts/db/schema'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const KEEPER_NAME = 'Sales'
const KEEPER_SLUG = 'sales'
const BOGUS_NAME = 'Sales Strategy'
const BOGUS_SLUG = 'sales-strategy'

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createDb(databaseUrl)

  // 1) Resolve the keeper: INTERNAL project name='Sales'/slug='sales',
  //    not soft-deleted. If multiple exist, keep the oldest.
  const keeperCandidates = await db
    .select({ id: projects.id, createdAt: projects.createdAt })
    .from(projects)
    .where(
      and(
        eq(projects.type, 'INTERNAL'),
        eq(projects.name, KEEPER_NAME),
        eq(projects.slug, KEEPER_SLUG),
        isNull(projects.deletedAt)
      )
    )
    .orderBy(projects.createdAt)

  const keeper = keeperCandidates[0]

  if (!keeper) {
    console.error(
      `No keeper found: expected an active INTERNAL project name='${KEEPER_NAME}' slug='${KEEPER_SLUG}'. Aborting.`
    )
    process.exitCode = 1
    return
  }

  console.log(
    `Keeper resolved: ${keeper.id} (created ${keeper.createdAt})` +
      (keeperCandidates.length > 1
        ? ` — note: ${keeperCandidates.length} active "Sales" projects exist; keeping oldest`
        : '')
  )

  // 2) Find bogus phantom projects: INTERNAL, not soft-deleted, matching the
  //    legacy name OR slug, excluding the keeper itself.
  const bogusProjects = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(
      and(
        eq(projects.type, 'INTERNAL'),
        isNull(projects.deletedAt),
        or(eq(projects.name, BOGUS_NAME), eq(projects.slug, BOGUS_SLUG))
      )
    )

  const bogusIds = bogusProjects
    .map(p => p.id)
    .filter(id => id !== keeper.id)

  if (bogusIds.length === 0) {
    console.log('No bogus "Sales Strategy" projects found. Nothing to do.')
    return
  }

  console.log(
    `Found ${bogusIds.length} bogus project(s): ${bogusProjects
      .filter(p => p.id !== keeper.id)
      .map(p => `${p.id} (name='${p.name}', slug='${p.slug}')`)
      .join(', ')}`
  )

  // 3) Re-point tasks from bogus projects onto the keeper.
  const movedTasks = await db
    .update(tasks)
    .set({ projectId: keeper.id, updatedAt: new Date().toISOString() })
    .where(inArray(tasks.projectId, bogusIds))
    .returning({ id: tasks.id })

  console.log(`Re-pointed ${movedTasks.length} task(s) to keeper ${keeper.id}.`)

  // 4) Soft-delete the bogus projects (only those still active).
  const deletedProjects = await db
    .update(projects)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(inArray(projects.id, bogusIds), isNull(projects.deletedAt)))
    .returning({ id: projects.id })

  console.log(`Soft-deleted ${deletedProjects.length} bogus project(s).`)
  console.log('Done.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('dedupe-sales-project failed:', error)
    process.exit(1)
  })
