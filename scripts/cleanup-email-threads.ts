/**
 * Data cleanup script for email threads
 *
 * Fixes issues caused by the orphan thread bug:
 * 1. Recalculates messageCount for all threads
 * 2. Removes duplicate threads (keeps the one with messages)
 * 3. Soft-deletes truly orphan threads (no messages, not the primary)
 *
 * Run with: npx tsx scripts/cleanup-email-threads.ts
 * Add --dry-run to preview changes without applying them
 */

import postgres from 'postgres'
import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(process.cwd(), '.env.local') })

const sql = postgres(process.env.DATABASE_URL!)

const isDryRun = process.argv.includes('--dry-run')

async function main() {
  console.log(`\n🧹 Email Thread Cleanup ${isDryRun ? '(DRY RUN)' : ''}\n`)
  console.log('='.repeat(60))

  // Step 1: Get current stats
  const [threadStats] = await sql`SELECT count(*)::int as count FROM threads WHERE deleted_at IS NULL`
  const [messageStats] = await sql`SELECT count(*)::int as count FROM messages WHERE deleted_at IS NULL`

  console.log(`\n📊 Current State:`)
  console.log(`   Threads: ${threadStats?.count ?? 0}`)
  console.log(`   Messages: ${messageStats?.count ?? 0}`)

  // Step 2: Find threads with wrong messageCount
  const threadsWithWrongCount = await sql<{
    id: string
    subject: string | null
    message_count: number
    actual_count: number
  }[]>`
    SELECT
      t.id,
      t.subject,
      t.message_count,
      COALESCE(m.actual_count, 0)::int as actual_count
    FROM threads t
    LEFT JOIN (
      SELECT thread_id, count(*)::int as actual_count
      FROM messages
      WHERE deleted_at IS NULL
      GROUP BY thread_id
    ) m ON t.id = m.thread_id
    WHERE t.deleted_at IS NULL
      AND t.message_count != COALESCE(m.actual_count, 0)
  `

  console.log(`\n📝 Threads with incorrect messageCount: ${threadsWithWrongCount.length}`)

  if (threadsWithWrongCount.length > 0) {
    console.log('\n   Sample (first 5):')
    for (const row of threadsWithWrongCount.slice(0, 5)) {
      console.log(`   - "${row.subject?.slice(0, 40) ?? '(no subject)'}": count=${row.message_count}, actual=${row.actual_count}`)
    }
  }

  // Step 3: Fix messageCount for all threads
  if (!isDryRun && threadsWithWrongCount.length > 0) {
    console.log('\n   Fixing messageCount...')

    await sql`
      UPDATE threads t
      SET
        message_count = COALESCE(m.actual_count, 0),
        updated_at = now()
      FROM (
        SELECT thread_id, count(*)::int as actual_count
        FROM messages
        WHERE deleted_at IS NULL
        GROUP BY thread_id
      ) m
      WHERE t.id = m.thread_id
        AND t.deleted_at IS NULL
        AND t.message_count != m.actual_count
    `

    // Also fix threads with 0 actual messages
    await sql`
      UPDATE threads
      SET message_count = 0, updated_at = now()
      WHERE deleted_at IS NULL
        AND message_count != 0
        AND id NOT IN (SELECT DISTINCT thread_id FROM messages WHERE deleted_at IS NULL)
    `

    console.log('   ✓ messageCount fixed')
  }

  // Step 4: Find duplicate threads
  const duplicateGroups = await sql<{
    external_thread_id: string
    count: number
  }[]>`
    SELECT external_thread_id, count(*)::int as count
    FROM threads
    WHERE deleted_at IS NULL
      AND external_thread_id IS NOT NULL
    GROUP BY external_thread_id
    HAVING count(*) > 1
    ORDER BY count DESC
  `

  console.log(`\n🔄 Duplicate thread groups: ${duplicateGroups.length}`)

  let totalDuplicatesRemoved = 0

  for (const group of duplicateGroups) {
    // For each duplicate group, find all threads
    const dupes = await sql<{
      id: string
      subject: string | null
      message_count: number
      created_at: string
    }[]>`
      SELECT id, subject, message_count, created_at
      FROM threads
      WHERE external_thread_id = ${group.external_thread_id}
        AND deleted_at IS NULL
      ORDER BY message_count DESC, created_at ASC
    `

    // Keep the first one (highest messageCount, oldest if tied)
    const [keep, ...toRemove] = dupes

    if (toRemove.length > 0) {
      console.log(`\n   External ID: ${group.external_thread_id}`)
      console.log(`   Keep: "${keep.subject?.slice(0, 40) ?? '(no subject)'}" (${keep.message_count} msgs)`)
      console.log(`   Remove: ${toRemove.length} duplicates`)

      if (!isDryRun) {
        for (const dupe of toRemove) {
          // Reassign any messages from duplicate threads to the kept thread
          await sql`
            UPDATE messages
            SET thread_id = ${keep.id}, updated_at = now()
            WHERE thread_id = ${dupe.id}
          `

          // Soft-delete the duplicate thread
          await sql`
            UPDATE threads
            SET deleted_at = now(), updated_at = now()
            WHERE id = ${dupe.id}
          `
        }
      }

      totalDuplicatesRemoved += toRemove.length
    }
  }

  console.log(`\n   Total duplicates ${isDryRun ? 'to remove' : 'removed'}: ${totalDuplicatesRemoved}`)

  // Step 5: Find and remove truly orphan threads (no messages)
  const orphanThreads = await sql<{ id: string; subject: string | null }[]>`
    SELECT t.id, t.subject
    FROM threads t
    WHERE t.deleted_at IS NULL
      AND t.message_count = 0
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.thread_id = t.id
        AND m.deleted_at IS NULL
      )
  `

  console.log(`\n🗑️  Orphan threads (no messages): ${orphanThreads.length}`)

  if (orphanThreads.length > 0 && !isDryRun) {
    console.log('   Soft-deleting orphan threads...')

    await sql`
      UPDATE threads
      SET deleted_at = now(), updated_at = now()
      WHERE deleted_at IS NULL
        AND message_count = 0
        AND NOT EXISTS (
          SELECT 1 FROM messages m
          WHERE m.thread_id = threads.id
          AND m.deleted_at IS NULL
        )
    `

    console.log(`   ✓ ${orphanThreads.length} orphan threads soft-deleted`)
  }

  // Step 6: Update lastMessageAt for threads
  if (!isDryRun) {
    console.log('\n📅 Updating lastMessageAt for all threads...')

    await sql`
      UPDATE threads t
      SET
        last_message_at = m.latest_sent_at,
        updated_at = now()
      FROM (
        SELECT thread_id, MAX(sent_at) as latest_sent_at
        FROM messages
        WHERE deleted_at IS NULL
        GROUP BY thread_id
      ) m
      WHERE t.id = m.thread_id
        AND t.deleted_at IS NULL
        AND (t.last_message_at IS NULL OR t.last_message_at != m.latest_sent_at)
    `

    console.log('   ✓ lastMessageAt updated')
  }

  // Final stats
  if (!isDryRun) {
    const [newThreadStats] = await sql`SELECT count(*)::int as count FROM threads WHERE deleted_at IS NULL`
    const [newMessageStats] = await sql`SELECT count(*)::int as count FROM messages WHERE deleted_at IS NULL`

    console.log(`\n📊 Final State:`)
    console.log(`   Threads: ${newThreadStats?.count ?? 0} (was ${threadStats?.count ?? 0})`)
    console.log(`   Messages: ${newMessageStats?.count ?? 0}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(isDryRun ? '✅ Dry run complete. Run without --dry-run to apply changes.' : '✅ Cleanup complete!')
  console.log('')

  await sql.end()
  process.exit(0)
}

main().catch(async err => {
  console.error('Cleanup failed:', err)
  await sql.end()
  process.exit(1)
})
