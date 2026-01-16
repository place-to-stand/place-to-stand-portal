# Schema Mapping Reference

**CRITICAL: This document is the canonical source of truth for Supabase → Convex field mapping.**

All migration scripts, Convex functions, and transformers MUST reference this document to ensure 1:1 data integrity.

---

## Guiding Principles

1. **Field names MUST match Supabase exactly** (converted from snake_case to camelCase)
2. **No new fields added during migration** - only `supabaseId` for tracking
3. **No fields removed** - preserve all Supabase fields
4. **Timestamps**: ISO strings → Unix milliseconds, dates stay as strings
5. **Foreign keys**: UUIDs → Convex IDs (resolved during import)

---

## Core Domain Tables

### users

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `email` | `email` | string | ✓ 1:1 |
| `full_name` | `fullName` | string? | ✓ 1:1 |
| `avatar_url` | `avatarUrl` | string? | Storage path/URL |
| `role` | `role` | "ADMIN" \| "CLIENT" | ✓ 1:1 |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

**Convex-only fields:**
- `authId` - Links to Convex Auth identity (populated after OAuth)

---

### clients

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `name` | `name` | string | ✓ 1:1 |
| `slug` | `slug` | string? | ✓ 1:1 (nullable) |
| `notes` | `notes` | string? | ✓ 1:1 |
| `billing_type` | `billingType` | "prepaid" \| "net_30" | ✓ 1:1 |
| `created_by` | `createdBy` | Id<"users">? | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### client_members → clientMembers

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (bigint) | → `supabaseId` | string | Migration tracking only |
| `client_id` | `clientId` | Id<"clients"> | FK resolved |
| `user_id` | `userId` | Id<"users"> | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | ✓ Added - soft delete support |

~~**ACTION REQUIRED**: Add `deletedAt` to Convex `clientMembers` table.~~ **DONE** (Phase 3A)

---

### projects

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `name` | `name` | string | ✓ 1:1 |
| `slug` | `slug` | string? | ✓ 1:1 (nullable) |
| `type` | `type` | "CLIENT" \| "PERSONAL" \| "INTERNAL" | ✓ 1:1 |
| `status` | `status` | project status enum | ✓ 1:1 |
| `starts_on` | `startsOn` | string? | ISO date string |
| `ends_on` | `endsOn` | string? | ISO date string |
| `client_id` | `clientId` | Id<"clients">? | FK resolved |
| `created_by` | `createdBy` | Id<"users">? | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### tasks

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `title` | `title` | string | ✓ 1:1 |
| `description` | `description` | string? | ✓ 1:1 |
| `status` | `status` | task status enum | ✓ 1:1 |
| `rank` | `rank` | string | ✓ 1:1 |
| `project_id` | `projectId` | Id<"projects"> | FK resolved |
| `due_on` | `dueOn` | string? | ISO date string |
| `created_by` | `createdBy` | Id<"users">? | FK resolved |
| `updated_by` | `updatedBy` | Id<"users">? | FK resolved |
| `accepted_at` | `acceptedAt` | number? | Timestamp (ms) |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### task_assignees → taskAssignees

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (bigint) | → `supabaseId` | string | Migration tracking only |
| `task_id` | `taskId` | Id<"tasks"> | FK resolved |
| `user_id` | `userId` | Id<"users"> | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

**Missing in Convex**: `updatedAt` - Supabase doesn't have this, but Convex schema includes it.

---

### task_assignee_metadata → taskAssigneeMetadata

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `task_id` | `taskId` | Id<"tasks"> | FK resolved (primary key part) |
| `user_id` | `userId` | Id<"users"> | FK resolved (primary key part) |
| `sort_order` | `sortOrder` | number | ✓ 1:1 |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

**Note**: Supabase uses composite primary key (task_id, user_id). Convex links via `assigneeId` to `taskAssignees`. Schema alignment needed.

---

### task_comments → taskComments

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `task_id` | `taskId` | Id<"tasks"> | FK resolved |
| `author_id` | `authorId` | Id<"users"> | FK resolved |
| `body` | `body` | string | ✓ 1:1 |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### task_attachments → taskAttachments

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `task_id` | `taskId` | Id<"tasks"> | FK resolved |
| `storage_path` | `storagePath` | string | ✓ 1:1 |
| `original_name` | `originalName` | string | ✓ 1:1 |
| `mime_type` | `mimeType` | string | ✓ 1:1 |
| `file_size` | `fileSize` | number | ✓ 1:1 |
| `uploaded_by` | `uploadedBy` | Id<"users"> | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

## Time Tracking Tables

### time_logs → timeLogs

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `project_id` | `projectId` | Id<"projects"> | FK resolved |
| `user_id` | `userId` | Id<"users"> | FK resolved |
| `hours` | `hours` | number | ✓ 1:1 |
| `logged_on` | `loggedOn` | string | ISO date string |
| `note` | `note` | string? | ✓ 1:1 |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### time_log_tasks → timeLogTasks

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `time_log_id` | `timeLogId` | Id<"timeLogs"> | FK resolved |
| `task_id` | `taskId` | Id<"tasks"> | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | - | - | **Supabase has this, verify in Convex** |

---

### hour_blocks → hourBlocks

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `client_id` | `clientId` | Id<"clients"> | FK resolved |
| `hours_purchased` | `hoursPurchased` | number | ✓ 1:1 |
| `invoice_number` | `invoiceNumber` | string? | ✓ 1:1 |
| `created_by` | `createdBy` | Id<"users">? | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

## CRM Tables

### leads

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `contact_name` | `contactName` | string | ✓ 1:1 |
| `contact_email` | `contactEmail` | string? | ✓ 1:1 |
| `contact_phone` | `contactPhone` | string? | ✓ 1:1 |
| `company_name` | `companyName` | string? | ✓ 1:1 |
| `company_website` | `companyWebsite` | string? | ✓ 1:1 |
| `status` | `status` | lead status enum | ✓ 1:1 |
| `source_type` | `sourceType` | lead source enum? | ✓ 1:1 |
| `source_detail` | `sourceDetail` | string? | ✓ 1:1 |
| `notes` | `notes` | any (jsonb) | ✓ 1:1 |
| `rank` | `rank` | string | ✓ 1:1 |
| `assignee_id` | `assigneeId` | Id<"users">? | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### contacts

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `email` | `email` | string | ✓ 1:1 |
| `name` | `name` | string | ✓ 1:1 |
| `phone` | `phone` | string? | ✓ 1:1 |
| `created_by` | `createdBy` | Id<"users">? | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |
| `updated_at` | `updatedAt` | number | Timestamp (ms) |
| `deleted_at` | `deletedAt` | number? | Timestamp (ms) |

---

### contact_clients → contactClients

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `contact_id` | `contactId` | Id<"contacts"> | FK resolved |
| `client_id` | `clientId` | Id<"clients"> | FK resolved |
| `is_primary` | `isPrimary` | boolean | ✓ 1:1 |
| `created_at` | `createdAt` | number | Timestamp (ms) |

---

### contact_leads → contactLeads

| Supabase Column | Convex Field | Type | Notes |
|-----------------|--------------|------|-------|
| `id` (UUID) | → `supabaseId` | string | Migration tracking only |
| `contact_id` | `contactId` | Id<"contacts"> | FK resolved |
| `lead_id` | `leadId` | Id<"leads"> | FK resolved |
| `created_at` | `createdAt` | number | Timestamp (ms) |

---

## Pre-Phase Checklist

Before starting any migration phase:

1. **Read this document** - Verify field mappings for tables in scope
2. **Run schema validation** - `npx tsx scripts/migrate/validate-schema.ts`
3. **Check for schema drift** - Ensure no ad-hoc changes were made
4. **Update transformers** - Use exact field names from this document
5. **Update import mutations** - Match transformer output exactly
6. **Test with sample data** - Before full migration

---

## Schema Validation Script Usage

```bash
# Validate all tables
npx tsx scripts/migrate/validate-schema.ts

# Validate specific table
npx tsx scripts/migrate/validate-schema.ts users

# Output detailed report
npx tsx scripts/migrate/validate-schema.ts --verbose
```

The validation script will:
- Compare Supabase schema (from Drizzle) with Convex schema
- Flag any field mismatches
- Warn about missing fields
- Ensure 1:1 alignment
