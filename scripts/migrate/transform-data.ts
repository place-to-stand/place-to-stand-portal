/**
 * Transform exported Supabase data for Convex import
 *
 * This script reads the JSON files from export-supabase.ts and transforms
 * them to match Convex schema requirements:
 * - Convert UUIDs to string references (stored as supabaseId)
 * - Convert dates to timestamps
 * - Rename fields to match Convex naming conventions
 *
 * Usage:
 *   npx tsx scripts/migrate/transform-data.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";

// ============================================================
// CONFIGURATION
// ============================================================

const INPUT_DIR = path.join(__dirname, "data");
const OUTPUT_DIR = path.join(__dirname, "data-transformed");

// ============================================================
// ID MAPPING
// ============================================================

// Maps Supabase UUIDs to temporary IDs for Convex import
// After import, these will be replaced with actual Convex IDs
const idMaps: Record<string, Map<string, string>> = {
  users: new Map(),
  clients: new Map(),
  projects: new Map(),
  tasks: new Map(),
  timeLogs: new Map(),
  taskAssignees: new Map(),
  taskComments: new Map(),
  taskAttachments: new Map(),
  leads: new Map(),
  contacts: new Map(),
  threads: new Map(),
  messages: new Map(),
  hourBlocks: new Map(),
  oauthConnections: new Map(),
  githubRepoLinks: new Map(),
};

// ============================================================
// TRANSFORM FUNCTIONS
// ============================================================

/**
 * Convert ISO date string or Date to Unix timestamp
 */
function toTimestamp(value: string | Date | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getTime();
}

/**
 * Generate temporary ID for mapping
 */
function generateTempId(table: string, supabaseId: string): string {
  const tempId = `temp_${table}_${idMaps[table]?.size ?? 0}`;
  idMaps[table]?.set(supabaseId, tempId);
  return tempId;
}

/**
 * Look up mapped ID (returns undefined if not found)
 */
function getMappedId(table: string, supabaseId: string | null | undefined): string | undefined {
  if (!supabaseId) return undefined;
  return idMaps[table]?.get(supabaseId);
}

// ============================================================
// TABLE TRANSFORMERS
// ============================================================

type TransformFn = (records: Record<string, unknown>[]) => Record<string, unknown>[];

const transformers: Record<string, TransformFn> = {
  users: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _tempId: generateTempId("users", r.id as string),
      email: r.email,
      name: r.name,
      role: r.role,
      avatarStorageId: undefined, // Will be migrated separately
      deletedAt: toTimestamp(r.deleted_at as string),
      createdAt: toTimestamp(r.created_at as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updated_at as string) ?? Date.now(),
    })),

  clients: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _tempId: generateTempId("clients", r.id as string),
      name: r.name,
      slug: r.slug,
      billingType: r.billing_type,
      website: r.website,
      notes: r.notes,
      deletedAt: toTimestamp(r.deleted_at as string),
      createdAt: toTimestamp(r.created_at as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updated_at as string) ?? Date.now(),
    })),

  clientMembers: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _tempClientId: getMappedId("clients", r.client_id as string),
      _tempUserId: getMappedId("users", r.user_id as string),
      _supabaseClientId: r.client_id,
      _supabaseUserId: r.user_id,
      createdAt: toTimestamp(r.created_at as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updated_at as string) ?? Date.now(),
    })),

  projects: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _tempId: generateTempId("projects", r.id as string),
      name: r.name,
      slug: r.slug,
      description: r.description,
      type: r.type,
      status: r.status,
      _tempClientId: getMappedId("clients", r.client_id as string),
      _tempCreatedById: getMappedId("users", r.created_by_id as string),
      _supabaseClientId: r.client_id,
      _supabaseCreatedById: r.created_by_id,
      deletedAt: toTimestamp(r.deleted_at as string),
      createdAt: toTimestamp(r.created_at as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updated_at as string) ?? Date.now(),
    })),

  tasks: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _tempId: generateTempId("tasks", r.id as string),
      title: r.title,
      description: r.description,
      status: r.status,
      rank: r.rank ?? "a0",
      _tempProjectId: getMappedId("projects", r.project_id as string),
      _supabaseProjectId: r.project_id,
      dueDate: toTimestamp(r.due_date as string),
      startDate: toTimestamp(r.start_date as string),
      priority: r.priority,
      estimate: r.estimate,
      deletedAt: toTimestamp(r.deleted_at as string),
      createdAt: toTimestamp(r.created_at as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updated_at as string) ?? Date.now(),
    })),

  // Add more transformers as needed...
  // For brevity, showing pattern - full implementation would include all tables
};

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🔄 Starting data transformation...\n");

  // Check input directory exists
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(
      `Input directory not found: ${INPUT_DIR}\nRun export-supabase.ts first.`
    );
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const transformSummary: Record<string, { input: number; output: number }> = {};

  // Process tables in order (build ID maps for foreign keys)
  const tables = [
    "users",
    "clients",
    "clientMembers",
    "projects",
    "tasks",
    // Add remaining tables in dependency order
  ];

  for (const tableName of tables) {
    const inputPath = path.join(INPUT_DIR, `${tableName}.json`);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${tableName} (no input file)`);
      continue;
    }

    console.log(`🔄 Transforming ${tableName}...`);

    const inputData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
    const transformer = transformers[tableName];

    if (!transformer) {
      console.log(`   ⚠️  No transformer defined, copying as-is`);
      const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(inputData, null, 2));
      transformSummary[tableName] = { input: inputData.length, output: inputData.length };
      continue;
    }

    const outputData = transformer(inputData);
    const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    transformSummary[tableName] = { input: inputData.length, output: outputData.length };
    console.log(`   ✅ Transformed ${inputData.length} → ${outputData.length} records`);
  }

  // Write ID mapping files for import step
  const mappingPath = path.join(OUTPUT_DIR, "_id-mappings.json");
  const mappings: Record<string, Record<string, string>> = {};
  for (const [table, map] of Object.entries(idMaps)) {
    mappings[table] = Object.fromEntries(map);
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));

  // Write summary
  const summaryPath = path.join(OUTPUT_DIR, "_transform-summary.json");
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        transformedAt: new Date().toISOString(),
        tables: transformSummary,
      },
      null,
      2
    )
  );

  console.log("\n✅ Transformation complete!");
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("❌ Transformation failed:", error);
  process.exit(1);
});
