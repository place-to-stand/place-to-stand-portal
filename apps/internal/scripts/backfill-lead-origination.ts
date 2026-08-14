/**
 * Backfill lead origination from the legacy free-text source (PRD 005 §05).
 *
 * Resolves `leads.source_detail` to a contact for REFERRAL leads, sets
 * `origination_contact_id`, and mirrors the link into `contact_leads`.
 *
 * AMBIGUITY IS FATAL, NOT A TIE-BREAK (W24). `contacts` is unique on `email`,
 * NOT on `name`, so two active contacts can share a name. A plain
 * `UPDATE … FROM` would let PostgreSQL pick either one nondeterministically —
 * and a wrong referrer flows into the client's origination and then into
 * partner payouts, which is strictly worse than leaving the field unset. This
 * script matches only names resolving to EXACTLY ONE active contact, prints an
 * ambiguity report for the rest, and exits non-zero so a human resolves them.
 *
 * EXACT MATCH ONLY (W8) — case- and whitespace-insensitive, never fuzzy or
 * partial. A false attribution is worse than no attribution.
 *
 * Values that resolve to no contact are left unset and will be DESTROYED by the
 * destructive migration (D15). The pre-flight audit is the only review gate;
 * this script's "unmatched" count is the number of values about to be lost.
 *
 * Idempotent: re-running only fills rows that are still null, and the
 * `contact_leads` insert is ON CONFLICT DO NOTHING.
 *
 * Run (from apps/internal, with DATABASE_URL available):
 *   npx tsx scripts/backfill-lead-origination.ts
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

  // --- Pre-flight -----------------------------------------------------------
  const preflight = await db.execute(sql`
    SELECT count(*)::int AS referral_rows,
           count(*) FILTER (WHERE source_detail IS NOT NULL
                              AND trim(source_detail) <> '')::int AS with_detail,
           count(*) FILTER (WHERE origination_contact_id IS NOT NULL)::int AS already_linked
    FROM leads
    WHERE source_type = 'REFERRAL' AND deleted_at IS NULL
  `)
  const pre = preflight[0] as Record<string, number> | undefined
  console.log(
    `Pre-flight — REFERRAL leads: ${pre?.referral_rows ?? 0}, with source_detail: ${
      pre?.with_detail ?? 0
    }, already linked: ${pre?.already_linked ?? 0}`
  )

  // --- Ambiguity report (W24) ----------------------------------------------
  // Reported BEFORE the update so an ambiguous name is never silently skipped.
  const ambiguous = await db.execute(sql`
    SELECT l.id, l.contact_name, l.source_detail, count(c.id)::int AS matching_contacts
    FROM leads l
    JOIN contacts c
      ON lower(trim(c.name)) = lower(trim(l.source_detail))
     AND c.deleted_at IS NULL
    WHERE l.source_type = 'REFERRAL'
      AND l.deleted_at IS NULL
      AND l.origination_contact_id IS NULL
    GROUP BY l.id, l.contact_name, l.source_detail
    HAVING count(c.id) > 1
  `)

  if (ambiguous.length > 0) {
    console.error(
      `\nAMBIGUOUS: ${ambiguous.length} lead(s) whose source_detail matches more than one active contact.`
    )
    console.error(
      'Resolve these by hand — an arbitrary pick would feed a wrong referrer into partner payouts.\n'
    )
    for (const row of ambiguous as Array<Record<string, unknown>>) {
      console.error(
        `  lead ${row.id} ("${row.contact_name}") source_detail="${row.source_detail}" → ${row.matching_contacts} contacts`
      )
    }
  }

  // --- Backfill -------------------------------------------------------------
  const updated = await db.execute(sql`
    WITH unique_contacts AS (
      -- (array_agg(id))[1], not min(id): Postgres has no min() for uuid. The
      -- HAVING clause guarantees exactly one row per name anyway, so this picks
      -- the only candidate rather than tie-breaking between several.
      SELECT lower(trim(name)) AS norm_name, (array_agg(id))[1] AS contact_id
      FROM contacts
      WHERE deleted_at IS NULL
      GROUP BY lower(trim(name))
      HAVING count(*) = 1
    )
    UPDATE leads l
    SET origination_contact_id = uc.contact_id
    FROM unique_contacts uc
    WHERE l.source_type = 'REFERRAL'
      AND l.source_detail IS NOT NULL
      AND trim(l.source_detail) <> ''
      AND l.deleted_at IS NULL
      AND l.origination_contact_id IS NULL
      AND uc.norm_name = lower(trim(l.source_detail))
    RETURNING l.id
  `)

  console.log(`Linked ${updated.length} lead(s) to an origination contact.`)

  // --- Mirror into the link table ------------------------------------------
  const linked = await db.execute(sql`
    INSERT INTO contact_leads (contact_id, lead_id)
    SELECT origination_contact_id, id FROM leads
    WHERE origination_contact_id IS NOT NULL
    ON CONFLICT ON CONSTRAINT contact_leads_contact_lead_key DO NOTHING
    RETURNING id
  `)

  console.log(`Created ${linked.length} contact_leads link row(s).`)

  // --- What will be destroyed (D15) ----------------------------------------
  const unmatched = await db.execute(sql`
    SELECT l.id, l.contact_name, l.source_type, l.source_detail
    FROM leads l
    WHERE l.deleted_at IS NULL
      AND l.source_detail IS NOT NULL
      AND trim(l.source_detail) <> ''
      AND l.origination_contact_id IS NULL
    ORDER BY l.source_type, l.source_detail
  `)

  if (unmatched.length > 0) {
    console.log(
      `\nUNMATCHED: ${unmatched.length} lead(s) carry a source_detail that resolved to no contact.`
    )
    console.log(
      'These values are PERMANENTLY DESTROYED by the destructive migration (D15).'
    )
    console.log('Review them before that migration is applied:\n')
    for (const row of unmatched as Array<Record<string, unknown>>) {
      console.log(
        `  lead ${row.id} ("${row.contact_name}") ${row.source_type} → "${row.source_detail}"`
      )
    }
  } else {
    console.log('\nUNMATCHED: none — no source_detail value will be lost.')
  }

  if (ambiguous.length > 0) {
    console.error('\nExiting non-zero: resolve the ambiguous rows above and re-run.')
    process.exitCode = 1
    return
  }

  console.log('\nDone.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('backfill-lead-origination failed:', error)
    process.exit(1)
  })
