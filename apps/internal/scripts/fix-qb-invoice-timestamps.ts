/**
 * One-off repair companion to backfill-qb-invoices.ts.
 *
 * The initial backfill run left two timestamp problems:
 *
 *   1. All 27 QB-* invoices shared one created_at (Postgres freezes now() for
 *      the whole transaction). The invoices list's "Issued" column sorts by
 *      created_at, so every QB invoice pinned to the top of the list in
 *      random tie-break order instead of interleaving chronologically.
 *      → Set each invoice's created_at/updated_at to its hour block's
 *        created_at, restoring the created ≈ issued invariant.
 *
 *   2. The hour_blocks_set_updated_at trigger bumped updated_at on every
 *      linked block regardless of what the UPDATE set. Every affected billing
 *      month is closed, and fetchLateRecords flags blocks with
 *      updated_at > closed_at as late changes on the Monthly Close Report.
 *      → Reset updated_at = created_at with the trigger briefly disabled
 *        (the blocks' financial fields were never touched).
 *
 * Idempotent: both updates converge on the same values; re-runs are no-ops.
 *
 * Run (from apps/internal, with DATABASE_URL for the target environment):
 *   npx tsx scripts/fix-qb-invoice-timestamps.ts
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

import { createDb } from '@pts/db/client'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createDb(databaseUrl)

  await db.transaction(async tx => {
    const invoiceResult = await tx.execute(sql`
      UPDATE invoices i
      SET created_at = hb.created_at,
          updated_at = hb.created_at
      FROM hour_blocks hb
      WHERE hb.invoice_id = i.id
        AND i.invoice_number LIKE 'QB-%'
        AND i.created_at <> hb.created_at
      RETURNING i.id
    `)
    console.log(`Backdated created_at on ${invoiceResult.length} invoice(s).`)

    // The trigger unconditionally overwrites updated_at on UPDATE, so it has
    // to be off while we restore the pre-backfill timestamps.
    await tx.execute(
      sql`ALTER TABLE hour_blocks DISABLE TRIGGER hour_blocks_set_updated_at`
    )

    const blockResult = await tx.execute(sql`
      UPDATE hour_blocks
      SET updated_at = created_at
      WHERE invoice_number LIKE 'QB-%'
        AND deleted_at IS NULL
        AND updated_at <> created_at
      RETURNING id
    `)
    console.log(`Reset updated_at on ${blockResult.length} hour block(s).`)

    await tx.execute(
      sql`ALTER TABLE hour_blocks ENABLE TRIGGER hour_blocks_set_updated_at`
    )
  })

  console.log('Done.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('fix-qb-invoice-timestamps failed:', error)
    process.exit(1)
  })
