/**
 * Validate Dual-Write Consistency
 *
 * Compares data between Supabase (source of truth) and Convex to ensure
 * dual-write operations are keeping both databases in sync.
 *
 * Usage:
 *   npx tsx scripts/migrate/validate-dual-write.ts           # Validate only
 *   npx tsx scripts/migrate/validate-dual-write.ts --fix     # Sync from Supabase to Convex
 *
 * Environment:
 *   - DATABASE_URL: PostgreSQL connection string (loaded from .env.local)
 *   - NEXT_PUBLIC_CONVEX_URL: Convex deployment URL (loaded from .env.local)
 *   - MIGRATION_KEY: Required for --fix mode
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { ConvexClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import * as schema from '../../lib/db/schema'

// ============================================================
// TYPES
// ============================================================

interface ValidationResult {
  table: string
  supabaseCount: number
  convexCount: number
  mismatches: Array<{
    supabaseId: string
    field: string
    supabaseValue: unknown
    convexValue: unknown
  }>
  missingInConvex: string[]
  missingInSupabase: string[]
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize a value for comparison
 * Treats null, undefined, empty string, and empty rich text as equivalent
 */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (value === '') return null
  if (value === '<p></p>') return null // Empty rich text
  if (value === '<p></p>\n') return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

async function validateClients(
  db: ReturnType<typeof drizzle>,
  convex: ConvexClient
): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: 'clients',
    supabaseCount: 0,
    convexCount: 0,
    mismatches: [],
    missingInConvex: [],
    missingInSupabase: [],
  }

  // Fetch all clients from Supabase
  const supabaseClients = await db.select().from(schema.clients)
  result.supabaseCount = supabaseClients.length

  // Fetch all clients from Convex (using internal query)
  const convexClients = await convex.query(api.migration.queries.listAllClients, {})
  result.convexCount = convexClients.length

  // Build maps for comparison
  const supabaseMap = new Map(supabaseClients.map((c) => [c.id, c]))
  const convexMap = new Map(convexClients.map((c: { supabaseId?: string }) => [c.supabaseId, c]))

  // Check each Supabase record against Convex
  for (const [supabaseId, supabaseClient] of supabaseMap) {
    const convexClient = convexMap.get(supabaseId) as Record<string, unknown> | undefined

    if (!convexClient) {
      result.missingInConvex.push(`${supabaseClient.name} (${supabaseId})`)
      continue
    }

    // Compare fields
    const fieldsToCompare = [
      { field: 'name', supabase: supabaseClient.name, convex: convexClient.name },
      { field: 'slug', supabase: supabaseClient.slug, convex: convexClient.slug },
      { field: 'billingType', supabase: supabaseClient.billingType, convex: convexClient.billingType },
      { field: 'notes', supabase: supabaseClient.notes, convex: convexClient.notes },
      {
        field: 'deletedAt',
        supabase: supabaseClient.deletedAt ? 'SET' : null,
        convex: convexClient.deletedAt ? 'SET' : null,
      },
    ]

    for (const { field, supabase, convex } of fieldsToCompare) {
      // Normalize values for comparison
      // Treat null, undefined, empty string, and empty rich text as equivalent
      const normalizedSupabase = normalizeValue(supabase)
      const normalizedConvex = normalizeValue(convex)

      if (normalizedSupabase !== normalizedConvex) {
        result.mismatches.push({
          supabaseId,
          field,
          supabaseValue: supabase,
          convexValue: convex,
        })
      }
    }
  }

  // Check for records in Convex that don't exist in Supabase
  for (const [supabaseId, convexClient] of convexMap) {
    if (supabaseId && !supabaseMap.has(supabaseId)) {
      result.missingInSupabase.push(`${(convexClient as { name: string }).name} (${supabaseId})`)
    }
  }

  return result
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const fixMode = process.argv.includes('--fix')

  console.log(`🔍 ${fixMode ? 'Validating and fixing' : 'Validating'} dual-write consistency...\n`)

  // Connect to Supabase
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const pgClient = postgres(databaseUrl)
  const db = drizzle(pgClient, { schema })

  // Connect to Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required')
  }

  // Check for migration key if in fix mode
  const migrationKey = process.env.MIGRATION_KEY
  if (fixMode && !migrationKey) {
    throw new Error('MIGRATION_KEY environment variable is required for --fix mode')
  }

  console.log(`📍 Supabase: ${databaseUrl.split('@')[1]?.split('/')[0] ?? 'connected'}`)
  console.log(`📍 Convex: ${convexUrl}\n`)

  const convex = new ConvexClient(convexUrl)

  try {
    // Validate clients
    console.log('📋 Validating clients...')
    const clientsResult = await validateClients(db, convex)
    printResult(clientsResult)

    // Fix discrepancies if in fix mode
    if (fixMode && migrationKey) {
      const hasIssues =
        clientsResult.mismatches.length > 0 ||
        clientsResult.missingInConvex.length > 0

      if (hasIssues) {
        console.log('\n🔧 Fixing discrepancies...')
        await syncClientsToConvex(db, convex, migrationKey, clientsResult)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))

    const totalMismatches = clientsResult.mismatches.length
    const totalMissingInConvex = clientsResult.missingInConvex.length
    const totalMissingInSupabase = clientsResult.missingInSupabase.length

    if (totalMismatches === 0 && totalMissingInConvex === 0 && totalMissingInSupabase === 0) {
      console.log('\n✅ All records are in sync!')
    } else {
      console.log(`\n⚠️  Found issues:`)
      if (totalMismatches > 0) console.log(`   - ${totalMismatches} field mismatches`)
      if (totalMissingInConvex > 0) console.log(`   - ${totalMissingInConvex} records missing in Convex`)
      if (totalMissingInSupabase > 0) console.log(`   - ${totalMissingInSupabase} records missing in Supabase`)

      if (!fixMode) {
        console.log('\n   Run with --fix to sync from Supabase to Convex')
      }
    }
  } finally {
    await pgClient.end()
    await convex.close()
  }
}

/**
 * Sync clients from Supabase to Convex
 */
async function syncClientsToConvex(
  db: ReturnType<typeof drizzle>,
  convex: ConvexClient,
  migrationKey: string,
  result: ValidationResult
) {
  // Get IDs of records that need syncing
  const idsToSync = new Set<string>()

  for (const mismatch of result.mismatches) {
    idsToSync.add(mismatch.supabaseId)
  }

  for (const missing of result.missingInConvex) {
    const match = missing.match(/\(([^)]+)\)$/)
    if (match) idsToSync.add(match[1])
  }

  if (idsToSync.size === 0) {
    console.log('   No records to sync')
    return
  }

  // Fetch and sync each client
  const supabaseClients = await db.select().from(schema.clients)

  for (const client of supabaseClients) {
    if (!idsToSync.has(client.id)) continue

    try {
      await convex.mutation(api.migration.mutations.importClient, {
        migrationKey,
        name: client.name,
        slug: client.slug ?? undefined,
        billingType: client.billingType,
        notes: client.notes ?? undefined,
        createdBySupabaseId: client.createdBy ?? undefined,
        supabaseId: client.id,
        createdAt: new Date(client.createdAt).getTime(),
        updatedAt: new Date(client.updatedAt).getTime() + 1, // Force update by adding 1ms
        deletedAt: client.deletedAt ? new Date(client.deletedAt).getTime() : undefined,
      })
      console.log(`   ✅ Synced: ${client.name}`)
    } catch (error) {
      console.log(`   ❌ Failed: ${client.name} - ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

function printResult(result: ValidationResult) {
  console.log(`   Supabase: ${result.supabaseCount} records`)
  console.log(`   Convex: ${result.convexCount} records`)

  if (result.mismatches.length > 0) {
    console.log(`   ⚠️  ${result.mismatches.length} field mismatches:`)
    for (const m of result.mismatches.slice(0, 10)) {
      console.log(`      - ${m.supabaseId}: ${m.field} = "${m.supabaseValue}" (Supabase) vs "${m.convexValue}" (Convex)`)
    }
    if (result.mismatches.length > 10) {
      console.log(`      ... and ${result.mismatches.length - 10} more`)
    }
  }

  if (result.missingInConvex.length > 0) {
    console.log(`   ⚠️  ${result.missingInConvex.length} missing in Convex:`)
    for (const m of result.missingInConvex.slice(0, 5)) {
      console.log(`      - ${m}`)
    }
    if (result.missingInConvex.length > 5) {
      console.log(`      ... and ${result.missingInConvex.length - 5} more`)
    }
  }

  if (result.missingInSupabase.length > 0) {
    console.log(`   ⚠️  ${result.missingInSupabase.length} missing in Supabase:`)
    for (const m of result.missingInSupabase.slice(0, 5)) {
      console.log(`      - ${m}`)
    }
    if (result.missingInSupabase.length > 5) {
      console.log(`      ... and ${result.missingInSupabase.length - 5} more`)
    }
  }

  if (result.mismatches.length === 0 && result.missingInConvex.length === 0 && result.missingInSupabase.length === 0) {
    console.log(`   ✅ All ${result.supabaseCount} records in sync`)
  }
}

main().catch((error) => {
  console.error('❌ Validation failed:', error)
  process.exit(1)
})
