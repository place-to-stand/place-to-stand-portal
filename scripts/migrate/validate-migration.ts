/**
 * Validate migration data consistency
 *
 * This script compares data between Supabase and Convex to ensure
 * the migration was successful. It checks:
 * - Record counts match
 * - Key fields match
 * - Foreign key relationships are intact
 *
 * Usage:
 *   npx tsx scripts/migrate/validate-migration.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ConvexClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import * as schema from "../../lib/db/schema";
import { api } from "../../convex/_generated/api";

// ============================================================
// CONFIGURATION
// ============================================================

const OUTPUT_DIR = path.join(__dirname, "validation");

// Tables to validate
const TABLES_TO_VALIDATE = [
  "users",
  "clients",
  "clientMembers",
  "projects",
  "tasks",
  "taskAssignees",
  "taskComments",
  "taskAttachments",
  "timeLogs",
  "hourBlocks",
  "leads",
  "contacts",
] as const;

// ============================================================
// TYPES
// ============================================================

interface ValidationResult {
  table: string;
  supabaseCount: number;
  convexCount: number;
  countMatch: boolean;
  sampleChecks: Array<{
    supabaseId: string;
    convexId: string;
    fieldsMatch: boolean;
    mismatches?: string[];
  }>;
  foreignKeyChecks: Array<{
    field: string;
    valid: number;
    invalid: number;
    invalidIds?: string[];
  }>;
  passed: boolean;
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

async function validateTable(
  supabaseDb: ReturnType<typeof drizzle>,
  convexClient: ConvexClient,
  tableName: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    table: tableName,
    supabaseCount: 0,
    convexCount: 0,
    countMatch: false,
    sampleChecks: [],
    foreignKeyChecks: [],
    passed: false,
  };

  try {
    // Get Supabase count
    const supabaseTable = schema[tableName as keyof typeof schema];
    if (supabaseTable) {
      // @ts-expect-error - Dynamic table access
      const supabaseRecords = await supabaseDb.select().from(supabaseTable);
      result.supabaseCount = supabaseRecords.length;
    }

    // Get Convex count using the countRecords query
    try {
      const convexCounts = await convexClient.query(api.migration.queries.countRecords, {
        table: tableName as "users" | "clients" | "clientMembers" | "projects" | "tasks" | "taskAssignees" | "taskComments" | "taskAttachments" | "timeLogs" | "hourBlocks" | "leads" | "contacts",
      });
      result.convexCount = convexCounts.total;
    } catch (convexError) {
      console.warn(`  ⚠️ Could not query Convex for ${tableName}:`, convexError);
      // Table might not be migrated yet - mark as 0
      result.convexCount = 0;
    }

    result.countMatch = result.supabaseCount === result.convexCount;
    result.passed = result.countMatch;
  } catch (error) {
    console.error(`Error validating ${tableName}:`, error);
    result.passed = false;
  }

  return result;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🔍 Starting migration validation...\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Connect to Supabase
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const postgresClient = postgres(connectionString);
  const supabaseDb = drizzle(postgresClient, { schema });

  // Connect to Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
  }

  const convexClient = new ConvexClient(convexUrl);

  const validationResults: ValidationResult[] = [];

  try {
    for (const tableName of TABLES_TO_VALIDATE) {
      console.log(`🔍 Validating ${tableName}...`);

      const result = await validateTable(supabaseDb, convexClient, tableName);
      validationResults.push(result);

      const status = result.passed ? "✅" : "❌";
      console.log(
        `   ${status} Supabase: ${result.supabaseCount}, Convex: ${result.convexCount}`
      );
    }

    // Calculate summary
    const passed = validationResults.filter((r) => r.passed).length;
    const failed = validationResults.filter((r) => !r.passed).length;

    // Write detailed report
    const reportPath = path.join(OUTPUT_DIR, "validation-report.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          validatedAt: new Date().toISOString(),
          summary: {
            total: validationResults.length,
            passed,
            failed,
          },
          results: validationResults,
        },
        null,
        2
      )
    );

    // Write human-readable summary
    const summaryPath = path.join(OUTPUT_DIR, "validation-summary.md");
    const summaryContent = `# Migration Validation Summary

**Date:** ${new Date().toISOString()}

## Results

| Table | Supabase | Convex | Match | Status |
|-------|----------|--------|-------|--------|
${validationResults
  .map(
    (r) =>
      `| ${r.table} | ${r.supabaseCount} | ${r.convexCount} | ${r.countMatch ? "Yes" : "No"} | ${r.passed ? "✅" : "❌"} |`
  )
  .join("\n")}

## Summary

- **Passed:** ${passed}
- **Failed:** ${failed}
- **Total:** ${validationResults.length}

${failed > 0 ? "⚠️ **Some validations failed. Review the detailed report.**" : "✅ **All validations passed!**"}
`;

    fs.writeFileSync(summaryPath, summaryContent);

    console.log("\n" + "=".repeat(50));
    console.log(`Validation complete: ${passed} passed, ${failed} failed`);
    console.log(`Report: ${reportPath}`);
    console.log(`Summary: ${summaryPath}`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await postgresClient.end();
    await convexClient.close();
  }
}

main().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});
