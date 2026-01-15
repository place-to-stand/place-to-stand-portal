/**
 * Import transformed data into Convex
 *
 * This script reads the transformed JSON files and imports them into Convex
 * using the Convex client and migration mutations.
 *
 * Field names are 1:1 with Supabase for stable migration.
 *
 * Usage:
 *   npx tsx scripts/migrate/import-convex.ts
 *
 * Environment:
 *   - NEXT_PUBLIC_CONVEX_URL: Convex deployment URL (loaded from .env.local)
 *   - MIGRATION_KEY: Secret key for authenticating migration (from .env.local)
 *
 * Prerequisites:
 *   1. Set MIGRATION_KEY in Convex dashboard environment variables
 *   2. Set MIGRATION_KEY in .env.local (same value)
 *   3. Deploy migration mutations: npx convex deploy
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { ConvexClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";

import { api } from "../../convex/_generated/api";

// ============================================================
// CONFIGURATION
// ============================================================

const INPUT_DIR = path.join(__dirname, "data-transformed");

// Import order (respecting foreign key dependencies)
const IMPORT_ORDER = [
  "users",
  "clients",
  "clientMembers",
  "projects",
  "tasks",
] as const;

type TableName = (typeof IMPORT_ORDER)[number];

// ============================================================
// ID RESOLUTION
// ============================================================

// Maps Supabase IDs to Convex IDs after insertion
const convexIdMaps: Record<string, Map<string, string>> = {};

for (const table of IMPORT_ORDER) {
  convexIdMaps[table] = new Map();
}

// ============================================================
// IMPORT FUNCTIONS
// ============================================================

interface ImportResult {
  table: string;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ record: unknown; error: string }>;
}

/**
 * Result type from Convex import mutations
 */
interface ConvexImportResult {
  id: string;
  operation: "inserted" | "updated" | "skipped";
}

/**
 * Transformed record types matching 1:1 with Supabase schema
 */
interface TransformedUser {
  email: string;
  fullName?: string | null; // Matches Supabase full_name
  avatarUrl?: string | null; // Matches Supabase avatar_url
  role: string;
  supabaseId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

interface TransformedClient {
  name: string;
  slug?: string | null;
  billingType: string;
  notes?: string | null;
  _supabaseCreatedById?: string | null;
  supabaseId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

interface TransformedClientMember {
  _supabaseClientId?: string | null;
  _supabaseUserId?: string | null;
  supabaseId: string;
  createdAt: number;
  updatedAt: number;
}

interface TransformedProject {
  name: string;
  slug?: string | null;
  type: string;
  status: string;
  startsOn?: string | null; // Matches Supabase starts_on
  endsOn?: string | null; // Matches Supabase ends_on
  _supabaseClientId?: string | null;
  _supabaseCreatedById?: string | null;
  supabaseId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

interface TransformedTask {
  title: string;
  description?: string | null;
  status: string;
  rank: string;
  dueOn?: string | null; // Matches Supabase due_on
  _supabaseProjectId?: string | null;
  _supabaseCreatedById?: string | null;
  _supabaseUpdatedById?: string | null;
  acceptedAt?: number | null;
  supabaseId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

/**
 * Convert null to undefined for Convex compatibility
 * Convex optional fields must be undefined, not null
 */
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

async function importUsers(
  client: ConvexClient,
  migrationKey: string,
  records: TransformedUser[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: "users",
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const { id, operation } = await client.mutation(api.migration.mutations.importUser, {
        migrationKey,
        email: record.email,
        fullName: nullToUndefined(record.fullName),
        avatarUrl: nullToUndefined(record.avatarUrl),
        role: record.role,
        supabaseId: record.supabaseId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: nullToUndefined(record.deletedAt),
      }) as ConvexImportResult;

      convexIdMaps.users.set(record.supabaseId, id);
      result[operation]++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push({ record, error: errorMessage });
    }
  }

  return result;
}

async function importClients(
  client: ConvexClient,
  migrationKey: string,
  records: TransformedClient[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: "clients",
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const { id, operation } = await client.mutation(api.migration.mutations.importClient, {
        migrationKey,
        name: record.name,
        slug: nullToUndefined(record.slug),
        billingType: record.billingType,
        notes: nullToUndefined(record.notes),
        createdBySupabaseId: nullToUndefined(record._supabaseCreatedById),
        supabaseId: record.supabaseId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: nullToUndefined(record.deletedAt),
      }) as ConvexImportResult;

      convexIdMaps.clients.set(record.supabaseId, id);
      result[operation]++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push({ record, error: errorMessage });
    }
  }

  return result;
}

async function importClientMembers(
  client: ConvexClient,
  migrationKey: string,
  records: TransformedClientMember[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: "clientMembers",
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    // Skip records without required foreign keys
    if (!record._supabaseClientId || !record._supabaseUserId) {
      result.skipped++;
      result.errors.push({
        record: { supabaseId: record.supabaseId },
        error: "Skipped: missing client or user reference",
      });
      continue;
    }

    try {
      const { id, operation } = await client.mutation(api.migration.mutations.importClientMember, {
        migrationKey,
        clientSupabaseId: record._supabaseClientId,
        userSupabaseId: record._supabaseUserId,
        supabaseId: record.supabaseId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }) as ConvexImportResult;

      convexIdMaps.clientMembers.set(record.supabaseId, id);
      result[operation]++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push({ record, error: errorMessage });
    }
  }

  return result;
}

async function importProjects(
  client: ConvexClient,
  migrationKey: string,
  records: TransformedProject[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: "projects",
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const { id, operation } = await client.mutation(api.migration.mutations.importProject, {
        migrationKey,
        name: record.name,
        slug: nullToUndefined(record.slug),
        type: record.type,
        status: record.status,
        startsOn: nullToUndefined(record.startsOn),
        endsOn: nullToUndefined(record.endsOn),
        clientSupabaseId: nullToUndefined(record._supabaseClientId),
        createdBySupabaseId: nullToUndefined(record._supabaseCreatedById),
        supabaseId: record.supabaseId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: nullToUndefined(record.deletedAt),
      }) as ConvexImportResult;

      convexIdMaps.projects.set(record.supabaseId, id);
      result[operation]++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push({ record, error: errorMessage });
    }
  }

  return result;
}

async function importTasks(
  client: ConvexClient,
  migrationKey: string,
  records: TransformedTask[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: "tasks",
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    // Skip orphan tasks (no project)
    if (!record._supabaseProjectId) {
      result.skipped++;
      result.errors.push({
        record: { supabaseId: record.supabaseId, title: record.title },
        error: "Skipped: task has no project (orphan task)",
      });
      continue;
    }

    try {
      const { id, operation } = await client.mutation(api.migration.mutations.importTask, {
        migrationKey,
        title: record.title,
        description: nullToUndefined(record.description),
        status: record.status,
        rank: record.rank,
        projectSupabaseId: record._supabaseProjectId,
        dueOn: nullToUndefined(record.dueOn),
        createdBySupabaseId: nullToUndefined(record._supabaseCreatedById),
        updatedBySupabaseId: nullToUndefined(record._supabaseUpdatedById),
        acceptedAt: nullToUndefined(record.acceptedAt),
        supabaseId: record.supabaseId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: nullToUndefined(record.deletedAt),
      }) as ConvexImportResult;

      convexIdMaps.tasks.set(record.supabaseId, id);
      result[operation]++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.failed++;
      result.errors.push({ record, error: errorMessage });
    }
  }

  return result;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("📥 Starting Convex import...\n");

  // Check input directory exists
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(
      `Input directory not found: ${INPUT_DIR}\nRun transform-data.ts first.`
    );
  }

  // Check for migration key
  const migrationKey = process.env.MIGRATION_KEY;
  if (!migrationKey) {
    throw new Error(
      "MIGRATION_KEY environment variable is required.\n" +
        "Set it in both:\n" +
        "  1. Convex dashboard environment variables\n" +
        "  2. .env.local file"
    );
  }

  // Connect to Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
  }

  console.log(`🔗 Connecting to Convex: ${convexUrl}\n`);
  const client = new ConvexClient(convexUrl);

  const importResults: ImportResult[] = [];

  try {
    // Import each table in order
    for (const tableName of IMPORT_ORDER) {
      const inputPath = path.join(INPUT_DIR, `${tableName}.json`);

      if (!fs.existsSync(inputPath)) {
        console.log(`⚠️  Skipping ${tableName} (no input file)`);
        continue;
      }

      console.log(`📥 Importing ${tableName}...`);

      const records = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
      let result: ImportResult;

      // Call the appropriate import function
      switch (tableName) {
        case "users":
          result = await importUsers(client, migrationKey, records);
          break;
        case "clients":
          result = await importClients(client, migrationKey, records);
          break;
        case "clientMembers":
          result = await importClientMembers(client, migrationKey, records);
          break;
        case "projects":
          result = await importProjects(client, migrationKey, records);
          break;
        case "tasks":
          result = await importTasks(client, migrationKey, records);
          break;
        default:
          console.log(`   ⏭️  No import function for ${tableName}`);
          continue;
      }

      importResults.push(result);
      console.log(
        `   ✅ Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}, Failed: ${result.failed}`
      );

      if (result.errors.length > 0) {
        console.log(`   ⚠️  ${result.errors.length} errors logged`);
        // Log first few errors for debugging
        for (const err of result.errors.slice(0, 3)) {
          console.log(`      - ${err.error}`);
        }
      }
    }

    // Write import summary
    const summaryPath = path.join(INPUT_DIR, "_import-summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          importedAt: new Date().toISOString(),
          results: importResults,
          totalInserted: importResults.reduce((a, r) => a + r.inserted, 0),
          totalUpdated: importResults.reduce((a, r) => a + r.updated, 0),
          totalSkipped: importResults.reduce((a, r) => a + r.skipped, 0),
          totalFailed: importResults.reduce((a, r) => a + r.failed, 0),
        },
        null,
        2
      )
    );

    // Write ID mappings for validation
    const mappingsPath = path.join(INPUT_DIR, "_convex-id-mappings.json");
    const mappings: Record<string, Record<string, string>> = {};
    for (const [table, map] of Object.entries(convexIdMaps)) {
      mappings[table] = Object.fromEntries(map);
    }
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));

    console.log("\n✅ Import complete!");
    console.log(
      `   Total inserted: ${importResults.reduce((a, r) => a + r.inserted, 0)}`
    );
    console.log(
      `   Total updated: ${importResults.reduce((a, r) => a + r.updated, 0)}`
    );
    console.log(
      `   Total skipped: ${importResults.reduce((a, r) => a + r.skipped, 0)}`
    );
    console.log(
      `   Total failed: ${importResults.reduce((a, r) => a + r.failed, 0)}`
    );
    console.log(`\n📄 Summary: ${summaryPath}`);
    console.log(`📄 ID Mappings: ${mappingsPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
