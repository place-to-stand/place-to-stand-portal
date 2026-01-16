'use server'

/**
 * Dual-Write Validator
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CRITICAL: Call this validator after EVERY dual-write operation during migration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This validator ensures Supabase and Convex remain in sync. If validation fails,
 * it logs an error to server console (grep for "[DUAL-WRITE VALIDATION ERROR]")
 * but does NOT throw - Supabase remains source of truth and the app continues.
 *
 * WHEN TO USE:
 * - After creating a record in both databases
 * - After updating a record in both databases
 * - After archiving/restoring a record in both databases
 *
 * IMPLEMENTATION CHECKLIST:
 * When adding dual-write to a new entity/mutation:
 * 1. Write to Supabase first (source of truth)
 * 2. Write to Convex second (best-effort, catch errors)
 * 3. Call the appropriate validate*DualWrite() function
 * 4. The validator logs errors but doesn't fail the operation
 *
 * EXAMPLE:
 *   // 1. Write to Supabase
 *   await db.update(clients).set({ name }).where(eq(clients.id, clientId))
 *
 *   // 2. Write to Convex (best-effort)
 *   try {
 *     await updateClientInConvex(clientId, { name })
 *
 *     // 3. Validate consistency
 *     await validateClientDualWrite(supabaseRecord, clientId)
 *   } catch (error) {
 *     console.error('Convex sync failed (non-fatal)', error)
 *   }
 *
 * MONITORING:
 * - Server logs: grep for "[DUAL-WRITE VALIDATION ERROR]"
 * - Batch validation: npx tsx scripts/migrate/validate-dual-write.ts
 * - Fix discrepancies: npx tsx scripts/migrate/validate-dual-write.ts --fix
 */

import { fetchQuery } from 'convex/nextjs'
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server'
import { api } from '@/convex/_generated/api'

// ============================================================
// TYPES
// ============================================================

interface ValidationMismatch {
  field: string
  supabaseValue: unknown
  convexValue: unknown
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

/**
 * Compare two values after normalization
 */
function valuesMatch(supabase: unknown, convex: unknown): boolean {
  const normalizedSupabase = normalizeValue(supabase)
  const normalizedConvex = normalizeValue(convex)
  return normalizedSupabase === normalizedConvex
}

/**
 * Log validation error with context
 * Logs to console.error for server-side visibility
 */
function logValidationError(
  entity: string,
  id: string,
  mismatches: ValidationMismatch[],
  missing: 'supabase' | 'convex' | null = null
): void {
  const prefix = `[DUAL-WRITE VALIDATION ERROR] ${entity} ${id}:`

  if (missing === 'convex') {
    console.error(`${prefix} Record exists in Supabase but NOT in Convex`)
    return
  }

  if (missing === 'supabase') {
    console.error(`${prefix} Record exists in Convex but NOT in Supabase`)
    return
  }

  if (mismatches.length > 0) {
    console.error(`${prefix} Field mismatches detected:`)
    for (const m of mismatches) {
      console.error(
        `  - ${m.field}: Supabase="${m.supabaseValue}" vs Convex="${m.convexValue}"`
      )
    }
  }
}

// ============================================================
// VALIDATORS
// ============================================================

/**
 * Validate a client record after dual-write
 *
 * Call this after creating or updating a client in both databases.
 * Logs an error if the records don't match but does NOT throw.
 *
 * @param supabaseClient - The client record from Supabase (after write)
 * @param supabaseId - The Supabase UUID for the client
 */
export async function validateClientDualWrite(
  supabaseClient: {
    id: string
    name: string
    slug: string | null
    billingType: string
    notes: string | null
    deletedAt: Date | null
  },
  supabaseId: string
): Promise<void> {
  try {
    // Fetch the corresponding Convex record
    const convexClients = await fetchQuery(
      api.migration.queries.listAllClients,
      {},
      { token: await convexAuthNextjsToken() }
    )

    const convexClient = convexClients.find(
      (c: { supabaseId?: string }) => c.supabaseId === supabaseId
    )

    if (!convexClient) {
      logValidationError('Client', supabaseId, [], 'convex')
      return
    }

    // Compare fields
    const mismatches: ValidationMismatch[] = []

    const fieldsToCompare: Array<{
      field: string
      supabase: unknown
      convex: unknown
    }> = [
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
      if (!valuesMatch(supabase, convex)) {
        mismatches.push({ field, supabaseValue: supabase, convexValue: convex })
      }
    }

    if (mismatches.length > 0) {
      logValidationError('Client', supabaseId, mismatches)
    }
  } catch (error) {
    // Log but don't throw - validation is informational during migration
    console.error(
      `[DUAL-WRITE VALIDATION] Failed to validate client ${supabaseId}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Validate a project record after dual-write
 *
 * @param supabaseProject - The project record from Supabase (after write)
 * @param supabaseId - The Supabase UUID for the project
 */
export async function validateProjectDualWrite(
  supabaseProject: {
    id: string
    name: string
    slug: string | null
    type: string
    status: string
    startsOn: string | null
    endsOn: string | null
    deletedAt: Date | null
  },
  supabaseId: string
): Promise<void> {
  try {
    const convexProjects = await fetchQuery(
      api.migration.queries.listAllProjects,
      {},
      { token: await convexAuthNextjsToken() }
    )

    const convexProject = convexProjects.find(
      (p: { supabaseId?: string }) => p.supabaseId === supabaseId
    )

    if (!convexProject) {
      logValidationError('Project', supabaseId, [], 'convex')
      return
    }

    const mismatches: ValidationMismatch[] = []

    const fieldsToCompare: Array<{
      field: string
      supabase: unknown
      convex: unknown
    }> = [
      { field: 'name', supabase: supabaseProject.name, convex: convexProject.name },
      { field: 'slug', supabase: supabaseProject.slug, convex: convexProject.slug },
      { field: 'type', supabase: supabaseProject.type, convex: convexProject.type },
      { field: 'status', supabase: supabaseProject.status, convex: convexProject.status },
      { field: 'startsOn', supabase: supabaseProject.startsOn, convex: convexProject.startsOn },
      { field: 'endsOn', supabase: supabaseProject.endsOn, convex: convexProject.endsOn },
      {
        field: 'deletedAt',
        supabase: supabaseProject.deletedAt ? 'SET' : null,
        convex: convexProject.deletedAt ? 'SET' : null,
      },
    ]

    for (const { field, supabase, convex } of fieldsToCompare) {
      if (!valuesMatch(supabase, convex)) {
        mismatches.push({ field, supabaseValue: supabase, convexValue: convex })
      }
    }

    if (mismatches.length > 0) {
      logValidationError('Project', supabaseId, mismatches)
    }
  } catch (error) {
    console.error(
      `[DUAL-WRITE VALIDATION] Failed to validate project ${supabaseId}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Validate a user record after dual-write
 *
 * @param supabaseUser - The user record from Supabase (after write)
 * @param supabaseId - The Supabase UUID for the user
 */
export async function validateUserDualWrite(
  supabaseUser: {
    id: string
    email: string
    fullName: string | null
    role: string
    avatarUrl: string | null
    deletedAt: Date | null
  },
  supabaseId: string
): Promise<void> {
  try {
    const convexUsers = await fetchQuery(
      api.migration.queries.listAllUsers,
      {},
      { token: await convexAuthNextjsToken() }
    )

    const convexUser = convexUsers.find(
      (u: { supabaseId?: string }) => u.supabaseId === supabaseId
    )

    if (!convexUser) {
      logValidationError('User', supabaseId, [], 'convex')
      return
    }

    const mismatches: ValidationMismatch[] = []

    const fieldsToCompare: Array<{
      field: string
      supabase: unknown
      convex: unknown
    }> = [
      { field: 'email', supabase: supabaseUser.email?.toLowerCase(), convex: convexUser.email?.toLowerCase() },
      { field: 'fullName', supabase: supabaseUser.fullName, convex: convexUser.fullName },
      { field: 'role', supabase: supabaseUser.role, convex: convexUser.role },
      { field: 'avatarUrl', supabase: supabaseUser.avatarUrl, convex: convexUser.avatarUrl },
      {
        field: 'deletedAt',
        supabase: supabaseUser.deletedAt ? 'SET' : null,
        convex: convexUser.deletedAt ? 'SET' : null,
      },
    ]

    for (const { field, supabase, convex } of fieldsToCompare) {
      if (!valuesMatch(supabase, convex)) {
        mismatches.push({ field, supabaseValue: supabase, convexValue: convex })
      }
    }

    if (mismatches.length > 0) {
      logValidationError('User', supabaseId, mismatches)
    }
  } catch (error) {
    console.error(
      `[DUAL-WRITE VALIDATION] Failed to validate user ${supabaseId}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}
