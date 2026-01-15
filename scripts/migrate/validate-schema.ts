/**
 * Schema Validation Script
 *
 * Validates that Convex schema matches Supabase schema 1:1.
 * Run this BEFORE each migration phase to catch mismatches early.
 *
 * Usage:
 *   npx tsx scripts/migrate/validate-schema.ts           # Validate all tables
 *   npx tsx scripts/migrate/validate-schema.ts users     # Validate specific table
 *   npx tsx scripts/migrate/validate-schema.ts --verbose # Detailed output
 *
 * This script reads the exported Supabase data and compares field names
 * with what the Convex schema expects.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================
// CONFIGURATION
// ============================================================

const DATA_DIR = path.join(__dirname, "data");

/**
 * Canonical field mappings from Supabase → Convex
 * This is the source of truth for 1:1 migration.
 *
 * Format: [supabaseField, convexField, isRequired]
 */
const SCHEMA_MAPPINGS: Record<string, Array<[string, string, boolean]>> = {
  users: [
    ["id", "supabaseId", true],
    ["email", "email", true],
    ["fullName", "fullName", false],
    ["avatarUrl", "avatarUrl", false],
    ["role", "role", true],
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  clients: [
    ["id", "supabaseId", true],
    ["name", "name", true],
    ["slug", "slug", false],
    ["notes", "notes", false],
    ["billingType", "billingType", true],
    ["createdBy", "_supabaseCreatedById", false], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  clientMembers: [
    ["id", "supabaseId", true],
    ["clientId", "_supabaseClientId", true], // FK - prefixed
    ["userId", "_supabaseUserId", true], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  projects: [
    ["id", "supabaseId", true],
    ["name", "name", true],
    ["slug", "slug", false],
    ["type", "type", true],
    ["status", "status", true],
    ["startsOn", "startsOn", false],
    ["endsOn", "endsOn", false],
    ["clientId", "_supabaseClientId", false], // FK - prefixed
    ["createdBy", "_supabaseCreatedById", false], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  tasks: [
    ["id", "supabaseId", true],
    ["title", "title", true],
    ["description", "description", false],
    ["status", "status", true],
    ["rank", "rank", true],
    ["projectId", "_supabaseProjectId", true], // FK - prefixed
    ["dueOn", "dueOn", false],
    ["createdBy", "_supabaseCreatedById", false], // FK - prefixed
    ["updatedBy", "_supabaseUpdatedById", false], // FK - prefixed
    ["acceptedAt", "acceptedAt", false],
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  taskAssignees: [
    ["id", "supabaseId", true],
    ["taskId", "_supabaseTaskId", true], // FK - prefixed
    ["userId", "_supabaseUserId", true], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  taskComments: [
    ["id", "supabaseId", true],
    ["taskId", "_supabaseTaskId", true], // FK - prefixed
    ["authorId", "_supabaseAuthorId", true], // FK - prefixed
    ["body", "body", true],
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  taskAttachments: [
    ["id", "supabaseId", true],
    ["taskId", "_supabaseTaskId", true], // FK - prefixed
    ["storagePath", "storagePath", true],
    ["originalName", "originalName", true],
    ["mimeType", "mimeType", true],
    ["fileSize", "fileSize", true],
    ["uploadedBy", "_supabaseUploadedBy", true], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  timeLogs: [
    ["id", "supabaseId", true],
    ["projectId", "_supabaseProjectId", true], // FK - prefixed
    ["userId", "_supabaseUserId", true], // FK - prefixed
    ["hours", "hours", true],
    ["loggedOn", "loggedOn", true],
    ["note", "note", false],
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  timeLogTasks: [
    ["id", "supabaseId", true],
    ["timeLogId", "_supabaseTimeLogId", true], // FK - prefixed
    ["taskId", "_supabaseTaskId", true], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
  ],
  hourBlocks: [
    ["id", "supabaseId", true],
    ["clientId", "_supabaseClientId", true], // FK - prefixed
    ["hoursPurchased", "hoursPurchased", true],
    ["invoiceNumber", "invoiceNumber", false],
    ["createdBy", "_supabaseCreatedById", false], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  leads: [
    ["id", "supabaseId", true],
    ["contactName", "contactName", true],
    ["contactEmail", "contactEmail", false],
    ["contactPhone", "contactPhone", false],
    ["companyName", "companyName", false],
    ["companyWebsite", "companyWebsite", false],
    ["status", "status", true],
    ["sourceType", "sourceType", false],
    ["sourceDetail", "sourceDetail", false],
    ["notes", "notes", true],
    ["rank", "rank", true],
    ["assigneeId", "_supabaseAssigneeId", false], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  contacts: [
    ["id", "supabaseId", true],
    ["email", "email", true],
    ["name", "name", true],
    ["phone", "phone", false],
    ["createdBy", "_supabaseCreatedById", false], // FK - prefixed
    ["createdAt", "createdAt", true],
    ["updatedAt", "updatedAt", true],
    ["deletedAt", "deletedAt", false],
  ],
  contactClients: [
    ["id", "supabaseId", true],
    ["contactId", "_supabaseContactId", true], // FK - prefixed
    ["clientId", "_supabaseClientId", true], // FK - prefixed
    ["isPrimary", "isPrimary", true],
    ["createdAt", "createdAt", true],
  ],
  contactLeads: [
    ["id", "supabaseId", true],
    ["contactId", "_supabaseContactId", true], // FK - prefixed
    ["leadId", "_supabaseLeadId", true], // FK - prefixed
    ["createdAt", "createdAt", true],
  ],
};

// ============================================================
// VALIDATION LOGIC
// ============================================================

interface ValidationResult {
  table: string;
  valid: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
}

function validateTable(tableName: string, verbose: boolean): ValidationResult | null {
  const mapping = SCHEMA_MAPPINGS[tableName];
  if (!mapping) {
    console.log(`\n  No mapping defined for table: ${tableName}`);
    return null;
  }

  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      table: tableName,
      valid: false,
      recordCount: 0,
      errors: [`Data file not found: ${filePath}`],
      warnings: [],
    };
  }

  const records = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>[];
  const result: ValidationResult = {
    table: tableName,
    valid: true,
    recordCount: records.length,
    errors: [],
    warnings: [],
  };

  if (records.length === 0) {
    result.warnings.push("No records to validate");
    return result;
  }

  // Sample first record
  const sample = records[0];
  const sampleFields = Object.keys(sample);

  // Check expected fields exist in data
  const expectedFields = mapping.map(([supabaseField]) => supabaseField);
  for (const [supabaseField, _convexField, isRequired] of mapping) {
    if (!sampleFields.includes(supabaseField)) {
      if (isRequired) {
        result.errors.push(`Missing required field in data: ${supabaseField}`);
        result.valid = false;
      } else {
        result.warnings.push(`Missing optional field in data: ${supabaseField}`);
      }
    }
  }

  // Check for extra fields in data not in mapping
  for (const field of sampleFields) {
    if (!expectedFields.includes(field)) {
      result.warnings.push(`Extra field in data not in mapping: ${field}`);
    }
  }

  if (verbose && records.length > 0) {
    console.log(`\n  Sample record fields: ${sampleFields.join(", ")}`);
    console.log(`  Expected fields: ${expectedFields.join(", ")}`);
  }

  return result;
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const tableFilter = args.find((a) => !a.startsWith("--"));

  console.log("========================================");
  console.log("   SCHEMA VALIDATION");
  console.log("   1:1 Supabase → Convex Mapping");
  console.log("========================================\n");

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Error: Data directory not found: ${DATA_DIR}`);
    console.error("Run export-supabase.ts first to export data.\n");
    process.exit(1);
  }

  const tablesToValidate = tableFilter
    ? [tableFilter]
    : Object.keys(SCHEMA_MAPPINGS);

  const results: ValidationResult[] = [];
  let hasErrors = false;

  for (const tableName of tablesToValidate) {
    console.log(`Validating ${tableName}...`);
    const result = validateTable(tableName, verbose);
    if (result) {
      results.push(result);
      if (!result.valid) hasErrors = true;

      // Output result
      if (result.valid) {
        console.log(`  ✅ Valid (${result.recordCount} records)`);
      } else {
        console.log(`  ❌ Invalid`);
      }

      if (result.errors.length > 0) {
        console.log(`  Errors:`);
        for (const err of result.errors) {
          console.log(`    - ${err}`);
        }
      }

      if (result.warnings.length > 0 && verbose) {
        console.log(`  Warnings:`);
        for (const warn of result.warnings) {
          console.log(`    - ${warn}`);
        }
      }
    }
  }

  // Summary
  console.log("\n========================================");
  console.log("   SUMMARY");
  console.log("========================================");

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.filter((r) => !r.valid).length;
  const totalRecords = results.reduce((a, r) => a + r.recordCount, 0);

  console.log(`\n  Tables validated: ${results.length}`);
  console.log(`  Valid: ${validCount}`);
  console.log(`  Invalid: ${invalidCount}`);
  console.log(`  Total records: ${totalRecords}`);

  if (hasErrors) {
    console.log("\n❌ Validation FAILED - Fix errors before migrating\n");
    process.exit(1);
  } else {
    console.log("\n✅ Validation PASSED - Schema is aligned\n");
    process.exit(0);
  }
}

main();
