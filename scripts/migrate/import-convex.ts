/**
 * Import transformed data into Convex
 *
 * This script reads the transformed JSON files and imports them into Convex
 * using the Convex client. It handles ID resolution and foreign key mapping.
 *
 * Usage:
 *   npx tsx scripts/migrate/import-convex.ts
 *
 * Environment:
 *   - NEXT_PUBLIC_CONVEX_URL: Convex deployment URL (loaded from .env.local)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { ConvexClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";

// Import the API - uncomment after generating Convex functions
// import { api } from "../../convex/_generated/api";

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
  "taskAssignees",
  "taskAssigneeMetadata",
  "taskComments",
  "taskAttachments",
  "timeLogs",
  "timeLogTasks",
  "hourBlocks",
  "leads",
  "contacts",
  "contactClients",
  "contactLeads",
  "oauthConnections",
  "githubRepoLinks",
  "activityLogs",
  "threads",
  "messages",
  "suggestions",
] as const;

// ============================================================
// ID RESOLUTION
// ============================================================

// Maps temp IDs to actual Convex IDs after insertion
const convexIdMaps: Record<string, Map<string, string>> = {};

for (const table of IMPORT_ORDER) {
  convexIdMaps[table] = new Map();
}

/**
 * Resolve temp ID to Convex ID
 */
function resolveId(table: string, tempId: string | undefined): string | undefined {
  if (!tempId) return undefined;
  return convexIdMaps[table]?.get(tempId);
}

// ============================================================
// IMPORT FUNCTIONS
// ============================================================

interface ImportResult {
  table: string;
  success: number;
  failed: number;
  errors: Array<{ record: unknown; error: string }>;
}

async function importTable(
  client: ConvexClient,
  tableName: string,
  records: Record<string, unknown>[]
): Promise<ImportResult> {
  const result: ImportResult = {
    table: tableName,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      // Resolve foreign key references
      const resolved = resolveReferences(tableName, record);

      // Remove temp fields before insert
      const cleanRecord = Object.fromEntries(
        Object.entries(resolved).filter(([k]) => !k.startsWith("_temp"))
      );

      // TODO: Call the appropriate Convex mutation
      // const convexId = await client.mutation(api.migration.insertRecord, {
      //   table: tableName,
      //   data: cleanRecord,
      // });

      // For now, simulate success
      const convexId = `convex_${tableName}_${result.success}`;

      // Store mapping for temp ID resolution
      if (record._tempId) {
        convexIdMaps[tableName]?.set(record._tempId as string, convexId);
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        record,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * Resolve foreign key references in a record
 */
function resolveReferences(
  tableName: string,
  record: Record<string, unknown>
): Record<string, unknown> {
  const resolved = { ...record };

  // Map of temp fields to resolved fields by table
  const fieldMappings: Record<string, Record<string, string>> = {
    clientMembers: {
      _tempClientId: "clientId",
      _tempUserId: "userId",
    },
    projects: {
      _tempClientId: "clientId",
      _tempCreatedById: "createdById",
    },
    tasks: {
      _tempProjectId: "projectId",
    },
    taskAssignees: {
      _tempTaskId: "taskId",
      _tempUserId: "userId",
    },
    taskComments: {
      _tempTaskId: "taskId",
      _tempAuthorId: "authorId",
      _tempParentId: "parentId",
    },
    // Add more mappings as needed
  };

  const mappings = fieldMappings[tableName];
  if (mappings) {
    for (const [tempField, targetField] of Object.entries(mappings)) {
      if (record[tempField]) {
        const table = tempField.replace("_temp", "").replace("Id", "").toLowerCase() + "s";
        resolved[targetField] = resolveId(table, record[tempField] as string);
      }
    }
  }

  return resolved;
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

  // Connect to Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
  }

  const client = new ConvexClient(convexUrl);

  const importResults: ImportResult[] = [];

  try {
    for (const tableName of IMPORT_ORDER) {
      const inputPath = path.join(INPUT_DIR, `${tableName}.json`);

      if (!fs.existsSync(inputPath)) {
        console.log(`⚠️  Skipping ${tableName} (no input file)`);
        continue;
      }

      console.log(`📥 Importing ${tableName}...`);

      const records = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
      const result = await importTable(client, tableName, records);

      importResults.push(result);
      console.log(`   ✅ Success: ${result.success}, Failed: ${result.failed}`);

      if (result.errors.length > 0) {
        console.log(`   ⚠️  ${result.errors.length} errors logged`);
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
          totalSuccess: importResults.reduce((a, r) => a + r.success, 0),
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
      `   Total success: ${importResults.reduce((a, r) => a + r.success, 0)}`
    );
    console.log(
      `   Total failed: ${importResults.reduce((a, r) => a + r.failed, 0)}`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
