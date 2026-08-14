/**
 * Seed the per-stage follow-up cadence defaults (PRD 005 §06, D22).
 *
 * The 3 / 7 / 7 / 30 values are SEED DEFAULTS, not hardcoded behavior — the
 * whole point of `lead_stage_settings` is that the team can tune them without a
 * deploy. `ON CONFLICT (status) DO NOTHING` therefore never stomps a tuned
 * value, which makes this script safe to re-run after every deploy.
 *
 * Terminal statuses (CLOSED_WON, CLOSED_LOST, UNQUALIFIED) deliberately get NO
 * row: absence means "never stale", which avoids the "is this unset or
 * deliberately never?" ambiguity a NULL row would introduce.
 *
 * Running this is optional for correctness — an unseeded table falls back to
 * LEAD_STALE_AFTER_DAYS (C14) — but it is what makes the values editable in the
 * UI, so run it.
 *
 * Run (from apps/internal, with DATABASE_URL available):
 *   npx tsx scripts/seed-lead-stage-settings.ts
 *
 * This script is NOT executed automatically.
 */

import { config } from 'dotenv'
import { asc } from 'drizzle-orm'

import { createDb } from '@pts/db/client'
import { leadStageSettings } from '@pts/db/schema'

// Mirror drizzle.config.ts env loading so the script can run standalone.
config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const SEED_DEFAULTS = [
  { status: 'NEW_OPPORTUNITIES', staleAfterDays: 3 },
  { status: 'ACTIVE_OPPORTUNITIES', staleAfterDays: 7 },
  { status: 'PROPOSAL_SENT', staleAfterDays: 7 },
  { status: 'ON_ICE', staleAfterDays: 30 },
] as const

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createDb(databaseUrl)

  const inserted = await db
    .insert(leadStageSettings)
    .values([...SEED_DEFAULTS])
    .onConflictDoNothing({ target: leadStageSettings.status })
    .returning({ status: leadStageSettings.status })

  console.log(
    inserted.length === 0
      ? 'All stages already configured. Nothing to do.'
      : `Seeded ${inserted.length} stage(s): ${inserted.map(row => row.status).join(', ')}`
  )

  const rows = await db
    .select({
      status: leadStageSettings.status,
      staleAfterDays: leadStageSettings.staleAfterDays,
    })
    .from(leadStageSettings)
    .orderBy(asc(leadStageSettings.status))

  console.log('Current thresholds:')
  for (const row of rows) {
    console.log(`  ${row.status}: ${row.staleAfterDays ?? 'never'}`)
  }
  console.log('Done.')
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(error => {
    console.error('seed-lead-stage-settings failed:', error)
    process.exit(1)
  })
