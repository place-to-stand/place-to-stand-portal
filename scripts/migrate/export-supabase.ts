/**
 * Export data from Supabase for migration to Convex
 *
 * This script connects to Supabase and exports all tables to JSON files
 * in the `scripts/migrate/data/` directory.
 *
 * Usage:
 *   npx tsx scripts/migrate/export-supabase.ts
 *
 * Environment:
 *   - DATABASE_URL: PostgreSQL connection string (loaded from .env.local)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../../lib/db/schema";

// ============================================================
// CONFIGURATION
// ============================================================

const OUTPUT_DIR = path.join(__dirname, "data");

// Tables to export in order (respecting foreign key dependencies)
const EXPORT_ORDER = [
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
// MAIN
// ============================================================

async function main() {
  console.log("🚀 Starting Supabase export...\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Connect to database
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  const exportSummary: Record<string, number> = {};

  try {
    for (const tableName of EXPORT_ORDER) {
      console.log(`📦 Exporting ${tableName}...`);

      const table = schema[tableName as keyof typeof schema];
      if (!table) {
        console.log(`   ⚠️  Table ${tableName} not found in schema, skipping`);
        continue;
      }

      // Query all records from the table
      // @ts-expect-error - Dynamic table access
      const records = await db.select().from(table);

      // Write to JSON file
      const outputPath = path.join(OUTPUT_DIR, `${tableName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));

      exportSummary[tableName] = records.length;
      console.log(`   ✅ Exported ${records.length} records`);
    }

    // Write summary
    const summaryPath = path.join(OUTPUT_DIR, "_export-summary.json");
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          tables: exportSummary,
          totalRecords: Object.values(exportSummary).reduce((a, b) => a + b, 0),
        },
        null,
        2
      )
    );

    console.log("\n✅ Export complete!");
    console.log(`   Output directory: ${OUTPUT_DIR}`);
    console.log(
      `   Total records: ${Object.values(exportSummary).reduce((a, b) => a + b, 0)}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("❌ Export failed:", error);
  process.exit(1);
});
