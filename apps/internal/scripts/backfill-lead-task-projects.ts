/**
 * Backfill existing lead tasks off the internal Sales project (PRD 005 §04, W22).
 *
 * Dropping `NOT NULL` from `tasks.project_id` changes nothing about existing
 * rows. `create-lead-task.ts` has always written BOTH `projectId` (the Sales
 * project) and `leadId`, so without this script there are two populations of
 * "lead task" with different board, portal, sheet, and time-log behavior — and
 * only the newly created one gets the D8 treatment.
 *
 * Scope is deliberately narrow: only tasks sitting on the INTERNAL `sales` /
 * `sales-strategy` projects. A task on a CLIENT project that merely references
 * a lead is a project task and keeps its project.
 *
 * Idempotent: once a row's project is null it no longer matches the WHERE, so
 * re-running reports 0 and changes nothing.
 *
 * Run (from apps/internal, with DATABASE_URL available):
 *   npx tsx scripts/backfill-lead-task-projects.ts
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

import { createDb } from '@pts/db/client'
import { projects, tasks } from '@pts/db/schema'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const SALES_SLUGS = ['sales', 'sales-strategy']

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createDb(databaseUrl)

  // Pre-flight (audit A7): which projects currently hold lead tasks?
  const preflight = await db
    .select({
      project: projects.name,
      slug: projects.slug,
      count: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(isNotNull(tasks.leadId), isNull(tasks.deletedAt)))
    .groupBy(projects.name, projects.slug)

  if (preflight.length === 0) {
    console.log('No lead tasks currently carry a project. Nothing to do.')
    return
  }

  console.log('Pre-flight — lead tasks by project:')
  for (const row of preflight) {
    console.log(`  ${row.project} (slug=${row.slug ?? 'null'}): ${row.count}`)
  }

  // Resolve the Sales project ids first: a correlated subquery in UPDATE ... FROM
  // is harder to read back than an explicit id list, and the set is tiny.
  const salesProjects = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(
      and(eq(projects.type, 'INTERNAL'), inArray(projects.slug, SALES_SLUGS))
    )

  if (salesProjects.length === 0) {
    console.log('No internal Sales project found. Nothing to backfill.')
    return
  }

  const salesIds = salesProjects.map(project => project.id)
  console.log(
    `Sales project(s) in scope: ${salesProjects
      .map(project => `${project.slug} (${project.id})`)
      .join(', ')}`
  )

  const updated = await db
    .update(tasks)
    .set({ projectId: null, updatedAt: new Date().toISOString() })
    .where(
      and(
        inArray(tasks.projectId, salesIds),
        isNotNull(tasks.leadId),
        isNull(tasks.deletedAt)
      )
    )
    .returning({ id: tasks.id })

  console.log(`Unanchored ${updated.length} lead task(s) from their project.`)

  const remaining = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, salesIds),
        isNotNull(tasks.leadId),
        isNull(tasks.deletedAt)
      )
    )

  console.log(`Remaining lead tasks on a Sales project: ${remaining[0]?.count ?? 0}`)
  console.log('Done.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('backfill-lead-task-projects failed:', error)
    process.exit(1)
  })
