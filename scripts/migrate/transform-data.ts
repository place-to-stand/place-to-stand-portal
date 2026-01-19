/**
 * Transform exported Supabase data for Convex import
 *
 * FIELD MAPPING STRATEGY:
 * - All field names are kept IDENTICAL between Supabase and Convex for 1:1 migration
 * - `id` is renamed to `supabaseId` for migration tracking
 * - ISO timestamp strings are converted to Unix milliseconds
 * - Foreign key UUIDs are preserved with `_supabase*` prefix for resolution during import
 *
 * This ensures the product remains stable during migration with zero data loss.
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
// TRANSFORM HELPERS
// ============================================================

/**
 * Convert ISO date string to Unix timestamp (milliseconds)
 */
function toTimestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.getTime();
}

// ============================================================
// TABLE TRANSFORMERS
// ============================================================

type TransformFn = (records: Record<string, unknown>[]) => Record<string, unknown>[];

const transformers: Record<string, TransformFn> = {
  /**
   * Users transform
   * Supabase: id, email, fullName, role, avatarUrl, createdAt, updatedAt, deletedAt
   * Convex:   supabaseId, email, fullName, role, avatarUrl, createdAt, updatedAt, deletedAt
   */
  users: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      email: r.email,
      fullName: r.fullName, // 1:1 mapping
      avatarUrl: r.avatarUrl, // 1:1 mapping (storage path)
      role: r.role,
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Clients transform
   * Supabase: id, name, slug, notes, billingType, createdBy, createdAt, updatedAt, deletedAt
   * Convex:   supabaseId, name, slug, notes, billingType, createdBy, createdAt, updatedAt, deletedAt
   */
  clients: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      name: r.name,
      slug: r.slug,
      billingType: r.billingType,
      notes: r.notes,
      _supabaseCreatedById: r.createdBy, // FK for resolution
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Client Members transform
   * Supabase: id (bigint), clientId, userId, createdAt, deletedAt
   * Convex:   supabaseId (string), clientId, userId, createdAt, updatedAt
   */
  clientMembers: (records) =>
    records.map((r) => ({
      supabaseId: String(r.id), // Convert bigint to string
      _supabaseClientId: r.clientId, // FK for resolution
      _supabaseUserId: r.userId, // FK for resolution
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.createdAt as string) ?? Date.now(), // Use createdAt since updatedAt doesn't exist
    })),

  /**
   * Projects transform
   * Supabase: id, clientId, name, status, startsOn, endsOn, createdBy, createdAt, updatedAt, deletedAt, slug, type
   * Convex:   supabaseId, clientId, name, status, startsOn, endsOn, createdBy, createdAt, updatedAt, deletedAt, slug, type
   */
  projects: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      name: r.name,
      slug: r.slug,
      type: r.type,
      status: r.status,
      startsOn: r.startsOn, // 1:1 mapping (date string)
      endsOn: r.endsOn, // 1:1 mapping (date string)
      _supabaseClientId: r.clientId, // FK for resolution (null for INTERNAL/PERSONAL)
      _supabaseCreatedById: r.createdBy, // FK for resolution
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Tasks transform
   * Supabase: id, projectId, title, description, status, dueOn, createdBy, updatedBy, createdAt, updatedAt, deletedAt, acceptedAt, rank
   * Convex:   supabaseId, projectId, title, description, status, dueOn, createdBy, updatedBy, createdAt, updatedAt, deletedAt, acceptedAt, rank
   */
  tasks: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      rank: r.rank ?? "a0", // Default rank if null
      dueOn: r.dueOn, // 1:1 mapping (date string)
      _supabaseProjectId: r.projectId, // FK for resolution
      _supabaseCreatedById: r.createdBy, // FK for resolution
      _supabaseUpdatedById: r.updatedBy, // FK for resolution
      acceptedAt: toTimestamp(r.acceptedAt as string),
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Task Assignees transform
   * Supabase: id (bigint), taskId, userId, createdAt, updatedAt, deletedAt
   * Convex:   supabaseId (string), taskId, userId, createdAt, updatedAt, deletedAt
   */
  taskAssignees: (records) =>
    records.map((r) => ({
      supabaseId: String(r.id), // Convert bigint to string
      _supabaseTaskId: r.taskId, // FK for resolution
      _supabaseUserId: r.userId, // FK for resolution
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Task Assignee Metadata transform
   * Supabase: taskId, userId, sortOrder, createdAt, updatedAt (composite PK, no id)
   * Convex:   supabaseId (generated), taskId, userId, sortOrder, createdAt, updatedAt
   */
  taskAssigneeMetadata: (records) =>
    records.map((r) => ({
      // Generate a supabaseId from the composite key since there's no id column
      supabaseId: `${r.taskId}_${r.userId}`,
      _supabaseTaskId: r.taskId, // FK for resolution
      _supabaseAssigneeId: r.userId, // FK for resolution (references users.id)
      sortOrder: r.sortOrder ?? 0,
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
    })),

  /**
   * Task Comments transform
   * Supabase: id, taskId, authorId, body, createdAt, updatedAt, deletedAt
   * Convex:   supabaseId, taskId, authorId, body, createdAt, updatedAt, deletedAt
   */
  taskComments: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _supabaseTaskId: r.taskId, // FK for resolution
      _supabaseAuthorId: r.authorId, // FK for resolution
      body: r.body,
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),

  /**
   * Task Attachments transform
   * Supabase: id, taskId, storagePath, originalName, mimeType, fileSize, uploadedBy, createdAt, updatedAt, deletedAt
   * Convex:   supabaseId, taskId, storagePath, originalName, mimeType, fileSize, uploadedBy, createdAt, updatedAt, deletedAt
   */
  taskAttachments: (records) =>
    records.map((r) => ({
      supabaseId: r.id,
      _supabaseTaskId: r.taskId, // FK for resolution
      storagePath: r.storagePath,
      originalName: r.originalName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      _supabaseUploadedById: r.uploadedBy, // FK for resolution
      createdAt: toTimestamp(r.createdAt as string) ?? Date.now(),
      updatedAt: toTimestamp(r.updatedAt as string) ?? Date.now(),
      deletedAt: toTimestamp(r.deletedAt as string),
    })),
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

  // Process tables in dependency order
  const tables = [
    "users",
    "clients",
    "clientMembers",
    "projects",
    "tasks",
    "taskAssignees",
    "taskAssigneeMetadata",
    "taskComments",
    "taskAttachments",
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

    // Show sample of first record for verification
    if (outputData.length > 0) {
      console.log(`   📋 Sample: ${JSON.stringify(outputData[0], null, 2).split("\n").slice(0, 8).join("\n")}...`);
    }
  }

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
