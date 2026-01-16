# Migration Checklist

Quick reference for tracking migration progress.

## Key Decisions Summary

| Decision | Choice |
|----------|--------|
| Current Auth | Email/Password via Supabase |
| Target Auth | Convex Auth + Google OAuth (NEW) |
| Auth Provider | Convex Auth + Google OAuth |
| Migration Style | Feature-by-feature |
| Dual Database | Yes, during transition |
| Feature Flags | Per-feature toggles with strict dependency enforcement |
| Session Transition | Force re-login with email-based account matching |
| OAuth Tokens | Same encryption key, port encryption functions |
| File Storage | Proxy routes for sensitive files |
| Real-time Scope | Subscribe at project level |
| Activity Retention | Archive after 1 year |
| Cascade Deletes | Block if children exist |
| Query Pattern | Convex hooks (phase out TanStack Query) |
| Server Actions | Keep, call Convex mutations internally |
| Logging | PostHog events for migration observability |
| Performance | Manual benchmark testing |
| **Schema Integrity** | **1:1 field mapping - see 006-schema-mapping.md** |
| **Live Migration** | Supabase remains source of truth; delta syncs before cutover |

---

## Live Migration Strategy

**Context:** The team continues using the portal daily during migration. Supabase is the active source of truth for all data except users (which are now authenticated via Convex).

### Source of Truth by Phase

| Phase | Supabase (Active) | Convex (Migrated) |
|-------|-------------------|-------------------|
| Phase 2 (Auth) | clients, projects, tasks, time_logs, etc. | users (auth only) |
| Phase 3A | projects, tasks, time_logs, etc. | users, clients, clientMembers |
| Phase 3B | tasks, time_logs, etc. | users, clients, projects |
| ... | ... | ... |
| Phase 5 (Complete) | — | All tables |

### Delta Sync Strategy

Since data changes continuously in Supabase, each phase requires a **delta sync** before enabling the feature flag:

1. **Initial Import** (done once per table)
   - Run full export → transform → import
   - Records get `supabaseId` for deduplication

2. **Delta Sync** (before enabling each phase's flag)
   ```bash
   # Re-export from Supabase (gets latest data)
   npx tsx scripts/migrate/export-supabase.ts

   # Transform (handles new + updated records)
   npx tsx scripts/migrate/transform-data.ts

   # Import (idempotent - skips existing supabaseIds, updates if needed)
   npx tsx scripts/migrate/import-convex.ts
   ```

3. **Import Script Behavior** (implemented in `convex/migration/mutations.ts`)
   - Records with matching `supabaseId` where source `updatedAt` > existing: **updated**
   - Records with matching `supabaseId` where source `updatedAt` <= existing: **skipped**
   - New records (no matching `supabaseId`): **inserted**

### Handling New Tables

The team may add new features (and tables) before migration completes. At Phase 5:

1. **Discovery Checklist**
   - [ ] Compare current Supabase schema to `006-schema-mapping.md`
   - [ ] List any new tables added since migration started
   - [ ] For each new table:
     - [ ] Add to Convex schema (`convex/schema.ts`)
     - [ ] Add transformer in `transform-data.ts`
     - [ ] Add import mutation in `convex/migration/mutations.ts`
     - [ ] Update `006-schema-mapping.md`

2. **Schema Diff Command**
   ```bash
   # Pull current Supabase schema
   npm run db:pull -- --out=drizzle/schema-current.ts

   # Compare to documented schema
   diff lib/db/schema.ts drizzle/schema-current.ts
   ```

### Final Cutover Checklist

Before disabling Supabase entirely (end of Phase 5):

- [ ] Run final delta sync for ALL tables
- [ ] Verify record counts match between databases
- [ ] Verify all feature flags are enabled (`true`)
- [ ] Run full regression test
- [ ] Monitor for 1 week with both databases
- [ ] Disable Supabase writes (read-only mode)
- [ ] Monitor for another week
- [ ] Archive Supabase data and disable project

---

## Full Dual-Write Pattern

**Established during Phase 3A (Clients)** - Apply this pattern to all data tables during migration.

### Overview

During migration, each table goes through these stages:

```
Stage 1: Supabase Only     → Initial state, no Convex code
Stage 2: Dual-Write        → Write to Supabase first, then Convex (best-effort)
Stage 3: Dual-Read         → Read from Convex, fall back to Supabase on error
Stage 4: Convex Only       → Remove Supabase code paths
```

### Dual-Write Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Server Action                                │
│                   (e.g., saveClientMutation)                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │  if (CONVEX_FLAGS.TABLE)  │
                    └─────────────┬─────────────┘
                           YES    │    NO
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │  1. Write to Supabase     │   │  Supabase Only Path       │
    │     (source of truth)     │   │  (existing code)          │
    │                           │   └───────────────────────────┘
    │  2. Write to Convex       │
    │     (best-effort, no fail)│
    │                           │
    │  3. Inline Validation     │
    │     (log mismatch errors) │
    └───────────────────────────┘
```

### Key Files per Table

For each migrated table, create/update these files:

| File | Purpose |
|------|---------|
| `convex/{table}/queries.ts` | Convex query functions |
| `convex/{table}/mutations.ts` | Convex mutation functions |
| `lib/data/{table}/convex.ts` | Server-side Convex wrappers (uses `fetchQuery`/`fetchMutation`) |
| `lib/data/{table}/index.ts` | Feature flag routing |
| `lib/settings/{table}/actions/*.ts` | Server actions with dual-write logic |

### Mutation Pattern

Every mutation follows this pattern:

```typescript
// lib/settings/{table}/actions/create-{table}.ts

export async function createTableMutation(context, payload) {
  // 1. Permission check
  assertAdmin(user)

  // 2. Check feature flag
  if (CONVEX_FLAGS.TABLE) {
    return createTableInConvex(context, payload)
  }

  // 3. Supabase-only path (existing code)
  // ...
}

async function createTableInConvex(context, payload) {
  // 1. Write to Supabase FIRST (source of truth)
  const inserted = await db.insert(table).values({...}).returning({ id: table.id })
  const supabaseId = inserted[0]?.id

  // 2. Write to Convex (best-effort, wrapped in try/catch)
  try {
    const { createInConvex } = await import('@/lib/data/{table}/convex')
    await createInConvex({
      ...fields,
      supabaseId, // Critical: links records for deduplication
    })

    // 3. Inline validation - compare records
    const { validateDualWrite } = await import('@/lib/data/dual-write-validator')
    await validateDualWrite(
      { id: supabaseId, ...expectedFields },
      supabaseId
    )
  } catch (convexError) {
    // Log but DON'T fail - Supabase is source of truth
    console.error('Failed to sync to Convex (non-fatal)', convexError)
  }

  // 4. Activity logging
  await logActivity({...})

  return buildMutationResult({ id: supabaseId })
}
```

### ID Resolution Pattern

Convex mutations must accept string IDs to handle both Convex IDs and Supabase UUIDs:

```typescript
// convex/{table}/mutations.ts

export const update = mutation({
  args: {
    id: v.string(), // Accept string, not v.id("table")
    // ... other fields
  },
  handler: async (ctx, args) => {
    // Try direct Convex ID lookup first
    let record = await ctx.db.get(args.id as Id<"table">).catch(() => null)

    // Fall back to supabaseId lookup
    if (!record) {
      record = await ctx.db
        .query("table")
        .withIndex("by_supabaseId", (q) => q.eq("supabaseId", args.id))
        .first()
    }

    if (!record) throw new NotFoundError("Record not found")

    // ... rest of mutation
  },
})
```

### Inline Validation

After every dual-write, validate consistency:

```typescript
// lib/data/dual-write-validator.ts

export async function validateTableDualWrite(
  expected: { id: string; name: string; /* fields */ },
  supabaseId: string
) {
  try {
    const { fetchByIdFromConvex } = await import('@/lib/data/{table}/convex')
    const convexRecord = await fetchByIdFromConvex(supabaseId)

    if (!convexRecord) {
      console.error('[DUAL-WRITE VALIDATION ERROR] Record not found in Convex', { supabaseId })
      return
    }

    const mismatches: string[] = []
    if (convexRecord.name !== expected.name) mismatches.push('name')
    // ... check other fields

    if (mismatches.length > 0) {
      console.error('[DUAL-WRITE VALIDATION ERROR] Field mismatch', {
        supabaseId,
        mismatches,
        expected,
        actual: convexRecord,
      })
    }
  } catch (error) {
    console.error('[DUAL-WRITE VALIDATION ERROR] Validation failed', { supabaseId, error })
  }
}
```

### Complete Operation Checklist

For each table, ensure ALL operations are dual-written:

| Operation | Server Action | Notes |
|-----------|---------------|-------|
| Create | `create-{table}.ts` | Return new ID in result |
| Update | `update-{table}.ts` | Use ID resolution pattern |
| Archive (soft delete) | `soft-delete-{table}.ts` | Set `deletedAt` timestamp |
| Restore | `restore-{table}.ts` | Clear `deletedAt` |
| Destroy (hard delete) | `destroy-{table}.ts` | Check children first |

### Query Pattern

Queries read from Convex when flag is enabled, with Supabase fallback:

```typescript
// lib/queries/{table}/list.ts

export async function listTable(user: AppUser) {
  if (CONVEX_FLAGS.TABLE) {
    try {
      return await listTableFromConvex()
    } catch (error) {
      console.error('Failed to fetch from Convex', error)
      // Fall through to Supabase
    }
  }

  // Supabase path (existing code)
  return db.select().from(table).where(...)
}
```

### Hybrid Data Enrichment

When migrated tables reference non-migrated tables, fetch enrichment data from Supabase:

```typescript
// lib/data/{table}/convex.ts

export async function fetchWithMetricsFromConvex() {
  // 1. Fetch primary data from Convex
  const records = await fetchQuery(api.table.queries.list, {}, { token })

  // 2. Get Supabase IDs for enrichment lookup
  const supabaseIds = records
    .map((r) => r.supabaseId)
    .filter((id): id is string => id !== undefined)

  // 3. Fetch related data from Supabase (non-migrated tables)
  const metricsMap = await fetchMetricsFromSupabase(supabaseIds)

  // 4. Combine and return
  return records.map((record) => ({
    ...mapToAppType(record),
    ...metricsMap.get(record.supabaseId),
  }))
}
```

---

## Join Table Migration Strategy

### Inventory of Join Tables

| Join Table | Left Entity | Right Entity | Migration Phase |
|------------|-------------|--------------|-----------------|
| `clientMembers` | clients | users | Phase 3A (with clients) |
| `contactClients` | contacts | clients | Phase 4C (with contacts) |
| `taskAssignees` | tasks | users | Phase 3C (with tasks) |
| `taskAssigneeMetadata` | tasks | users | Phase 3C (with tasks) |
| `timeLogTasks` | timeLogs | tasks | Phase 3D (with time logs) |
| `githubRepoLinks` | projects | (external) | Phase 4D (with integrations) |

### Migration Principle: Follow the Primary Entity

**Rule:** A join table migrates with its **primary entity** (the entity it extends/decorates).

- `clientMembers` → Primary is **clients** (extends client with members)
- `taskAssignees` → Primary is **tasks** (extends task with assignees)
- `contactClients` → Primary is **contacts** (links contacts to clients)

### Why This Approach?

1. **Avoids orphan references** - Both sides of the join exist before the join migrates
2. **Natural code locality** - Join table code lives with the primary entity's code
3. **Simpler queries** - Convex queries for "client with members" work immediately
4. **Clear ownership** - One team/phase owns the full feature scope

### Current State: Phase 3A (Clients)

| Join Table | Supabase | Convex | Dual-Write Status |
|------------|----------|--------|-------------------|
| `clientMembers` | ✅ Source of truth | ✅ Synced | Partial |

**`clientMembers` gaps to address:**

| Operation | Location | Status |
|-----------|----------|--------|
| Add on client create | `create-client.ts` | ✅ Dual-written |
| Add via settings UI | `syncClientMembers()` | ❌ Supabase only |
| Remove via settings UI | `syncClientMembers()` | ❌ Supabase only |
| Bulk sync | `syncClientMembers()` | ❌ Supabase only |

### Join Table Dual-Write Pattern

```typescript
// lib/settings/clients/client-service.ts

export async function syncClientMembers(
  clientId: string,
  memberIds: string[]
): Promise<ClientActionResult> {
  // 1. Get current members from Supabase
  const currentMembers = await db
    .select({ userId: clientMembers.userId })
    .from(clientMembers)
    .where(eq(clientMembers.clientId, clientId))

  const currentIds = new Set(currentMembers.map(m => m.userId))
  const targetIds = new Set(memberIds)

  const toAdd = memberIds.filter(id => !currentIds.has(id))
  const toRemove = [...currentIds].filter(id => !targetIds.has(id))

  // 2. Write to Supabase (source of truth)
  // ... existing Supabase code ...

  // 3. Sync to Convex if flag enabled
  if (CONVEX_FLAGS.CLIENTS) {
    try {
      const { addClientMemberInConvex, removeClientMemberInConvex } =
        await import('@/lib/data/clients/convex')

      for (const userId of toAdd) {
        await addClientMemberInConvex(clientId, userId)
      }
      for (const userId of toRemove) {
        await removeClientMemberInConvex(clientId, userId)
      }
    } catch (error) {
      console.error('Failed to sync client members to Convex (non-fatal)', error)
    }
  }

  return {}
}
```

### Future Phases: Join Table Checklist

#### Phase 3C: Tasks

```
☐ taskAssignees dual-write in task create/update
☐ taskAssigneeMetadata dual-write for sort order
☐ Validation for assignee sync
```

#### Phase 3D: Time Logs

```
☐ timeLogTasks dual-write when logging time
☐ Validation for task associations
```

#### Phase 4C: Contacts

```
☐ contacts table migration
☐ contactClients dual-write
☐ Validation for contact-client links
```

### Special Case: Access Control Join Tables

`clientMembers` is used by Convex for permission checks (`ensureClientAccess`). This means:

1. **Must be dual-written during Phase 3A** - Even though contacts/other features still use Supabase
2. **Convex data must be authoritative for auth** - `requireRole` and access checks use Convex
3. **Supabase remains source of truth for data** - Until full migration complete

```typescript
// convex/lib/permissions.ts

export async function ensureClientAccess(ctx: QueryCtx, userId: Id<"users">, clientId: Id<"clients">) {
  // Uses Convex clientMembers - must be kept in sync
  const membership = await ctx.db
    .query("clientMembers")
    .withIndex("by_client_user", (q) =>
      q.eq("clientId", clientId).eq("userId", userId)
    )
    .first()

  if (!membership) {
    throw new ForbiddenError("No access to this client")
  }
}
```

---

## MANDATORY: Pre-Phase Data Integrity Checklist

**CRITICAL: Complete ALL items before starting any data migration phase.**

Every migration phase that involves data import MUST follow this process:

### 1. Schema Verification
- [ ] Read `006-schema-mapping.md` for tables in scope
- [ ] Run `npx tsx scripts/migrate/validate-schema.ts` - must pass
- [ ] Verify no ad-hoc schema changes were made since last phase

### 2. Data Export (if re-exporting)
- [ ] Run `npx tsx scripts/migrate/export-supabase.ts`
- [ ] Verify record counts match expectations
- [ ] Spot-check exported JSON for field names

### 3. Transform Validation
- [ ] Verify transformer uses exact field names from schema mapping
- [ ] Run `npx tsx scripts/migrate/transform-data.ts`
- [ ] Verify transformed output matches Convex import args exactly

### 4. Import Mutation Review
- [ ] Verify mutation args match transformer output 1:1
- [ ] Verify mutation handler uses exact schema field names
- [ ] Deploy to Convex: `npx convex dev --once` or `npx convex deploy`

### 5. Test Import
- [ ] Import to dev environment first
- [ ] Verify record counts: success + skipped + failed = total
- [ ] Check `_import-summary.json` for errors
- [ ] Validate data in Convex dashboard

### 6. Production Migration
- [ ] Create backup of current Convex data (if any)
- [ ] Run import script
- [ ] Verify counts match dev
- [ ] Smoke test affected features

**If any step fails, STOP and fix before proceeding.**

---

## Phase 1: Setup & Foundation

### Environment Setup
- [x] Install Convex: `npm install convex @convex-dev/auth`
- [x] Initialize project: `npx convex init`
- [x] Set up Convex dashboard project
- [x] Configure environment variables
- [x] Verify `npx convex dev` works

### Schema Definition
- [x] Create `convex/schema.ts`
- [x] Define all 13 enum validators
- [x] Define all 26 document tables
- [x] Add indexes for query patterns
- [x] Add `supabaseId` migration fields (renamed from `_supabaseId` - underscore reserved)
- [x] Validate schema compiles

### Migration Scripts
- [x] Create `scripts/migrate/export-supabase.ts`
- [x] Create `scripts/migrate/transform-data.ts` (scaffold - 5 tables implemented)
- [x] Create `scripts/migrate/import-convex.ts` (scaffold - needs Convex mutations)
- [x] Create `scripts/migrate/validate-migration.ts`
- [x] Test export from dev Supabase (5,205 records exported)

> **Note:** Transform script needs remaining table transformers added per-domain. Import script needs Convex mutations created. These are completed as part of each domain's migration phase.

### Project Structure
- [x] Create `convex/lib/permissions.ts`
- [x] Create `convex/lib/validators.ts`
- [x] Create `convex/lib/softDelete.ts`
- [x] Create `convex/lib/time.ts` (timestamp helpers)
- [x] Create `convex/lib/encryption.ts` (port from lib/oauth/encryption.ts)
- [x] Create `convex/lib/validators/date.ts` (ISO date validation)
- [x] Create `convex/lib/validators/activityMetadata.ts` (typed metadata)
- [x] Create `lib/feature-flags.ts` with dependency validation

### Index Audit (Complete Before Phase 2)
- [x] Create `docs/prds/009-convex-migration/004-index-audit.md`
- [x] Audit all 47 query files in `lib/queries/`
- [x] Map each query to required Convex index
- [x] Verify schema has all necessary indexes
- [x] Document any missing indexes (none found)

### Observability Setup
- [x] Create `lib/posthog/migration-events.ts`
- [x] Create `lib/posthog/error-tracking.ts`
- [x] Add `migrationRuns` table to schema
- [x] Add `activityArchives` table to schema

> **Note:** PostHog migration dashboard setup moved to Phase 2 (after events are ingested)

### Adapter Interface
- [x] Create `lib/data/adapters/types.ts` with interface definitions
- [x] Create adapter interfaces for each domain (clients, projects, tasks, etc.)

---

## Phase 2: Auth Migration

**Note:** This phase introduces Google OAuth as a NEW authentication method. Users currently use email/password via Supabase and will transition to Google sign-in.

> **✅ Phase 2 Status: COMPLETE - SHIPPED**
>
> All infrastructure is in place:
> - Convex Auth configured with Google OAuth
> - Users migrated (4 users, 10 clients, 25 projects, 143 tasks)
> - Permission system ported and validated (8/8 tests passed)
> - Feature flag enabled (`NEXT_PUBLIC_USE_CONVEX_AUTH=true`)
> - Build passes, type-check clean
> - Manual testing passed (sign-in, session, sign-out, rollback)
> - Production deployment configured and verified

### Pre-Migration Communication
- [ ] Draft user communication about auth change (email/password → Google sign-in)
- [ ] Notify users of upcoming change
- [ ] Document what users need to do (sign in with Google using same email)

### Convex Auth Setup
- [x] Create `convex/auth.ts`
- [x] Create `convex/http.ts` (OAuth callback routes)
- [x] Configure Google OAuth provider (uses @auth/core)
- [x] Set Google Client ID/Secret in Convex dashboard
- [x] Implement email-based account matching callback
- [x] Set `OAUTH_TOKEN_ENCRYPTION_KEY` in Convex env vars

### User Migration
- [x] Export users from Supabase (using existing scripts)
- [x] Create `convex/users/mutations.ts` with import functions
- [x] Create `convex/users/queries.ts` for user fetching
- [x] Run import script to migrate users (4 users, 10 clients, 25 projects, 143 tasks - 0 failures)
- [x] Verify user count matches
- [x] Verify roles preserved correctly (all ADMIN roles retained)

### Auth Components
- [x] Create `<ConvexProvider>` (components/providers/convex-provider.tsx)
- [x] Create `<GoogleSignInButton>` (components/auth/google-sign-in-button.tsx)
- [x] Create `<SignOutButton>` (components/auth/sign-out-button.tsx)
- [x] Create `useConvexUser()` hook (hooks/use-convex-user.ts)

### Compatibility Layer
- [x] Create `lib/auth/convex-session.ts`
- [x] Implement `getConvexCurrentUser()` wrapper
- [x] Implement `requireConvexUser()` wrapper
- [x] Implement `requireConvexRole()` wrapper
- [x] Update `lib/auth/session.ts` with feature flag branching

### Permission System (Already ported in Phase 1)
- [x] Port `isAdmin()` to Convex (convex/lib/permissions.ts)
- [x] Port `assertAdmin()` to Convex
- [x] Port `ensureClientAccess()` to Convex
- [x] Port `listAccessibleClientIds()` to Convex

### Storage Migration
- [x] Create `convex/storage/avatars.ts`
- [x] Create `convex/storage/attachments.ts`
- [ ] Migrate avatar files (run after auth enabled)
- [ ] Migrate task attachment files (run after auth enabled)
- [ ] Update upload routes (client-side components)

### Permission Parity Validation
- [x] Create `scripts/migrate/validate-permissions.ts`
- [x] Add test cases for admin access
- [x] Add test cases for client user access
- [x] Add test cases for project access (CLIENT/PERSONAL/INTERNAL)
- [x] Add test cases for task access
- [x] Run validation before enabling feature flags (8/8 passed)

### Storage Proxy Routes
- [x] Update `app/api/storage/task-attachment/[attachmentId]/route.ts` for Convex
- [x] Update `app/api/storage/user-avatar/[userId]/route.ts` for Convex
- [ ] Verify permission checks work with Convex
- [ ] Test file proxy functionality

### Observability (deferred from Phase 1)
- [ ] Set up PostHog migration dashboard (now that events are being ingested)
  - `migration_data_source_hit` by source (convex vs supabase)
  - `migration_dual_read_mismatch` count
  - `convex_error` count by function
  - `migration_phase_update` timeline

### Testing
> **Status:** ✅ Manual testing completed successfully.

- [x] Test Google OAuth sign-in (manual: visit /sign-in and click "Continue with Google")
- [x] Test session persistence (manual: refresh page, verify still logged in)
- [x] Test sign-out (manual: click sign out, verify redirected to /sign-in)
- [x] Test protected routes (manual: access dashboard routes while authenticated)
- [x] Test feature flag rollback (toggle back to Supabase, verify still works)
- [ ] Test file uploads (deferred to Phase 4F - storage migration)
- [ ] Test file retrieval (deferred to Phase 4F - storage migration)
- [x] Test permission parity (run validation script) - 8/8 passed

### Performance Benchmark (Before/After)
- [ ] Sign-in time: ___ms (before) → ___ms (after)
- [ ] Page load with auth check: ___ms (before) → ___ms (after)

### Rollback Ready
- [x] Feature flag `USE_CONVEX_AUTH` working (currently enabled)
- [x] Can toggle back to Supabase Auth (set NEXT_PUBLIC_USE_CONVEX_AUTH=false)
- [x] Both auth systems functional (code paths preserved)

---

## Phase 3A: Clients & Access Control

> **Status: COMPLETE - Ready for production**
>
> All core functionality implemented:
> - Convex queries and mutations deployed
> - Full dual-write for create, update, archive, restore, destroy
> - Member sync to Convex on create and update
> - ID resolution supports both Convex IDs and Supabase UUIDs
> - Type-check, lint, and build all pass

### Convex Functions
- [x] Create `convex/clients/queries.ts`
- [x] Create `convex/clients/mutations.ts`
- [x] Implement `list` query (with permissions)
- [x] Implement `listWithProjectCounts` query (dashboard)
- [x] Implement `listArchivedWithProjectCounts` query (archive page)
- [x] Implement `getBySlug` query
- [x] Implement `getById` query (with supabaseId fallback)
- [x] Implement `getMembers` query
- [x] Implement `create` mutation
- [x] Implement `update` mutation (accepts string ID)
- [x] Implement `archive` mutation (with child check - block if has projects)
- [x] Implement `restore` mutation (accepts string ID)
- [x] Implement `destroy` mutation (hard delete, accepts string ID)
- [x] Implement `addMember` / `removeMember` mutations (accept string IDs with supabaseId resolution)
- [x] Add uniqueness check in `clientMembers.create` (via addMember mutation)
- [x] Add `deletedAt` field to `clientMembers` schema (per schema-mapping.md)

### Data Migration
- [x] Export clients from Supabase (done in Phase 2)
- [x] Import to Convex (done in Phase 2 - 10 clients)
- [x] Export client_members from Supabase (done in Phase 2)
- [x] Import to Convex (done in Phase 2)
- [x] Delta sync script supports `deletedAt` changes
- [x] Validate relationships (implicit via supabaseId foreign keys)
- [ ] Record migration in `migrationRuns` table (deferred to Phase 5)

### Data Layer Integration
- [x] Create `lib/data/clients/convex.ts` with Convex wrappers
- [x] Update `lib/data/clients/index.ts` with feature flag branching
- [x] Type mappings from Convex to existing types (uses `supabaseId` for compatibility)
- [x] Hybrid data enrichment (hour metrics from Supabase)

### Dual-Write Implementation
- [x] Create client → Supabase + Convex
- [x] Update client → Supabase + Convex (including member sync)
- [x] Archive client → Supabase + Convex
- [x] Restore client → Supabase + Convex
- [x] Destroy client → Supabase + Convex
- [x] Inline validation after every dual-write (`lib/data/dual-write-validator.ts`)
- [x] Member changes sync to Convex on create and update

### Dual-Read Layer
- [x] Update `lib/data/clients/` to use Convex
- [x] Feature flag `USE_CONVEX_CLIENTS` configured (requires AUTH enabled)
- [x] Settings list page routes to Convex
- [x] Archive list page routes to Convex
- [x] Dashboard client list routes to Convex
- [ ] Add PostHog tracking for data source hits (deferred - low priority)

### Testing
- [x] Client list loads correctly
- [x] Client detail page works
- [x] Client creation works (with contact linking)
- [x] Client editing works
- [x] Client archiving works
- [x] Client restore works
- [x] Client hard delete works
- [x] Hours remaining column displays correctly
- [x] Admin sees all clients (verified via Convex permissions)
- [x] Non-admin access controlled via clientMembers (permissions enforced in queries)

### Production Deployment
- [x] Convex functions deployed to production
- [x] Build passes with no errors
- [x] Type-check passes
- [ ] Enable `NEXT_PUBLIC_USE_CONVEX_CLIENTS=true` in production

### Performance Benchmark
- [ ] Client list load time: ___ms (before) → ___ms (after)

---

## Phase 3B: Projects

### Convex Functions
- [ ] Create `convex/projects/queries.ts`
- [ ] Create `convex/projects/mutations.ts`
- [ ] Implement `list` query (with type filtering)
- [ ] Implement `getBySlug` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `archive` mutation (with child check - block if has active tasks)

### Data Migration
- [ ] Export projects from Supabase
- [ ] Import to Convex
- [ ] Validate client relationships
- [ ] Record migration in `migrationRuns` table

### Adapter Implementation
- [ ] Create `lib/data/adapters/projects-supabase.ts`
- [ ] Create `lib/data/adapters/projects-convex.ts`
- [ ] Both implement `ProjectsAdapter` interface

### Dual-Read Layer
- [ ] Update `lib/data/projects/` to use Convex
- [ ] Feature flag `USE_CONVEX_PROJECTS` (requires AUTH + CLIENTS enabled)
- [ ] Add PostHog tracking for data source hits

### Testing
- [ ] PROJECT type filtering works
- [ ] PERSONAL projects only visible to creator
- [ ] INTERNAL projects visible to all
- [ ] CLIENT projects respect membership
- [ ] Slug-based routing works
- [ ] Archive blocked if active tasks exist

### Performance Benchmark
- [ ] Projects list load: ___ms (before) → ___ms (after)
- [ ] Project board load: ___ms (before) → ___ms (after)

---

## Phase 3C: Tasks

### Convex Functions
- [ ] Create `convex/tasks/queries.ts`
- [ ] Create `convex/tasks/mutations.ts`
- [ ] Implement `listByProject` query (with project-level subscription)
- [ ] Implement `listByProjectPaginated` query (for large projects)
- [ ] Implement `getById` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `updateStatus` mutation
- [ ] Implement `reorder` mutation
- [ ] Add uniqueness check in `taskAssignees.create`

### Related Tables
- [ ] Migrate task_assignees
- [ ] Migrate task_assignee_metadata
- [ ] Migrate task_comments
- [ ] Migrate task_attachments
- [ ] Record migration in `migrationRuns` table

### Real-time Subscriptions (New!)
- [ ] Use `useQuery(api.tasks.listByProject, { projectId })` for board
- [ ] Verify real-time updates work across browser tabs
- [ ] Test live collaboration (multiple users)
- [ ] Implement optimistic updates for drag-drop

### Pagination
- [ ] Implement `usePaginatedQuery` for task lists
- [ ] Add "Load more" for lists exceeding 50 items

### Testing
- [ ] Kanban board renders
- [ ] Drag-and-drop works
- [ ] Status transitions work
- [ ] Task creation works
- [ ] Task editing works
- [ ] Comments work
- [ ] Attachments work
- [ ] Real-time updates work
- [ ] Pagination works

### Performance Benchmark
- [ ] Kanban board initial load: ___ms (before) → ___ms (after)
- [ ] Task drag-drop: ___ms (before) → ___ms (after)

---

## Phase 3D: Time Tracking

### Convex Functions
- [ ] Create `convex/timeLogs/queries.ts`
- [ ] Create `convex/timeLogs/mutations.ts`
- [ ] Implement project time summary
- [ ] Implement user time summary
- [ ] Implement create mutation
- [ ] Implement validation (task-project match)

### Data Migration
- [ ] Export time_logs from Supabase
- [ ] Export time_log_tasks from Supabase
- [ ] Import to Convex

### Testing
- [ ] Time entry creation works
- [ ] Task association works
- [ ] Project totals calculate correctly
- [ ] User totals calculate correctly

---

## Phase 4A: Activity System

### Convex Functions
- [ ] Create `convex/activity/mutations.ts`
- [ ] Create `convex/activity/queries.ts`
- [ ] Implement typed metadata validators
- [ ] Port activity event handlers from `lib/activity/events/`

### Data Migration
- [ ] Migrate activity_logs → activityLogs
- [ ] Migrate activity_overview_cache → activityCache
- [ ] Record migration in `migrationRuns` table

### Scheduled Functions (Cron)
- [ ] Create `convex/crons.ts`
- [ ] Implement `archiveOldLogs` internal mutation
- [ ] Schedule monthly archival job (1st of month, 3am UTC)
- [ ] Test archival to `activityArchives` table

### Cache Recomputation
- [ ] Implement cache refresh logic
- [ ] Update cache computation for 1/7/14/28 day windows

### Testing
- [ ] Activity feeds display correctly
- [ ] Event handlers log to Convex
- [ ] Archival job runs successfully
- [ ] Archived logs retrievable from file storage

---

## Phase 4B: Hour Blocks

- [ ] Create `convex/hourBlocks/` functions
- [ ] Migrate hour_blocks
- [ ] Update dashboard widgets
- [ ] Test burn-down calculation

---

## Phase 4C: Leads & CRM

- [ ] Create `convex/leads/` functions
- [ ] Create `convex/contacts/` functions
- [ ] Migrate leads
- [ ] Migrate contacts
- [ ] Migrate junction tables
- [ ] Update lead intake webhook
- [ ] Test lead board

---

## Phase 4D: Integrations

- [ ] Create `convex/integrations/` functions
- [ ] Migrate oauth_connections
- [ ] Migrate github_repo_links
- [ ] Update OAuth flows
- [ ] Test Google integration
- [ ] Test GitHub integration

---

## Phase 4E: Messaging

- [ ] Create `convex/messaging/` functions
- [ ] Migrate threads
- [ ] Migrate messages
- [ ] Migrate suggestions
- [ ] Test email workflows

---

## Phase 4F: File Storage Migration

**See `007-file-storage-migration.md` for detailed plan.**

Migrate all files from Supabase Storage to Convex Storage.

### Schema Update
- [ ] Add `avatarStorageId` field to users table
- [ ] Add `storageId` field to taskAttachments table
- [ ] Deploy schema changes

### Update Upload Functions
- [ ] Update avatar upload to use Convex storage
- [ ] Update attachment upload to use Convex storage
- [ ] Update client-side upload components
- [ ] Test new uploads work with Convex

### Migrate Existing Files
- [ ] Create `scripts/migrate/migrate-files.ts`
- [ ] Count files to migrate (run Supabase queries)
- [ ] Migrate user avatars to Convex Storage
- [ ] Migrate task attachments to Convex Storage
- [ ] Verify all files accessible via Convex

### Update Read Functions
- [ ] Update `getAvatarUrl` to prefer Convex storageId
- [ ] Update `getAttachmentUrl` to prefer Convex storageId
- [ ] Update/remove Supabase proxy routes
- [ ] Test all file access paths

### Cleanup (After Verification)
- [ ] Remove `avatarUrl` field (string path) from users
- [ ] Remove `storagePath` field from taskAttachments
- [ ] Delete Supabase Storage buckets

---

## Phase 5: Cleanup

### Remove Supabase Code
- [ ] Remove all feature flags (enable Convex everywhere)
- [ ] Delete `lib/supabase/` directory
- [ ] Delete `lib/db/` directory (Drizzle)
- [ ] Delete `drizzle/` migrations folder
- [ ] Remove Supabase type definitions
- [ ] Delete adapter Supabase implementations (`*-supabase.ts`)
- [ ] Remove adapter branching logic

### Remove TanStack Query (if fully migrated)
- [ ] Verify all data fetching uses Convex hooks
- [ ] Remove `@tanstack/react-query` if unused for other purposes
- [ ] Remove `ReactQueryProvider` from providers

### Remove Dependencies
- [ ] `npm uninstall @supabase/supabase-js`
- [ ] `npm uninstall @supabase/ssr`
- [ ] `npm uninstall drizzle-orm`
- [ ] `npm uninstall drizzle-kit`
- [ ] Remove postgres driver if unused

### Clean Up Environment
- [ ] Remove `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Remove `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Update CI/CD pipelines

### Remove Migration Artifacts
- [ ] Remove `supabaseId` indexes from schema (optional, or leave for debugging)
- [ ] Remove PostHog migration tracking events (optional)
- [ ] Archive migration scripts to separate folder

### Final Validation
- [ ] Full regression test
- [ ] Performance benchmark comparison
- [ ] Security review
- [ ] Monitor production for 1 week
- [ ] Verify no Supabase API calls in logs

### Archive
- [ ] Export final Supabase data backup
- [ ] Archive migration scripts
- [ ] Document migration lessons learned
- [ ] Review `migrationRuns` table for issues
- [ ] Disable Supabase project

---

## Feature Flag Reference

```typescript
// lib/feature-flags.ts
export const CONVEX_FLAGS = {
  AUTH: process.env.NEXT_PUBLIC_USE_CONVEX_AUTH === 'true',
  STORAGE: process.env.NEXT_PUBLIC_USE_CONVEX_STORAGE === 'true',
  CLIENTS: process.env.NEXT_PUBLIC_USE_CONVEX_CLIENTS === 'true',
  PROJECTS: process.env.NEXT_PUBLIC_USE_CONVEX_PROJECTS === 'true',
  TASKS: process.env.NEXT_PUBLIC_USE_CONVEX_TASKS === 'true',
  TIME_LOGS: process.env.NEXT_PUBLIC_USE_CONVEX_TIME_LOGS === 'true',
  ACTIVITY: process.env.NEXT_PUBLIC_USE_CONVEX_ACTIVITY === 'true',
  HOUR_BLOCKS: process.env.NEXT_PUBLIC_USE_CONVEX_HOUR_BLOCKS === 'true',
  LEADS: process.env.NEXT_PUBLIC_USE_CONVEX_LEADS === 'true',
  MESSAGING: process.env.NEXT_PUBLIC_USE_CONVEX_MESSAGING === 'true',
};

// STRICT ENFORCEMENT: Flag dependencies
const FLAG_DEPENDENCIES = {
  AUTH: [],                              // No dependencies
  STORAGE: ['AUTH'],                     // Requires AUTH
  CLIENTS: ['AUTH'],                     // Requires AUTH
  PROJECTS: ['AUTH', 'CLIENTS'],         // Requires AUTH + CLIENTS
  TASKS: ['AUTH', 'PROJECTS'],           // Requires AUTH + PROJECTS
  TIME_LOGS: ['AUTH', 'PROJECTS', 'TASKS'], // Requires AUTH + PROJECTS + TASKS
  ACTIVITY: ['AUTH'],                    // Requires AUTH
  HOUR_BLOCKS: ['AUTH', 'CLIENTS'],      // Requires AUTH + CLIENTS
  LEADS: ['AUTH'],                       // Requires AUTH
  MESSAGING: ['AUTH'],                   // Requires AUTH
};

// Call at app startup - throws if dependencies not met
validateFeatureFlags();
```

### Recommended Enable Order

1. `AUTH` (Phase 2)
2. `STORAGE` (Phase 2)
3. `CLIENTS` (Phase 3A)
4. `PROJECTS` (Phase 3B)
5. `TASKS` (Phase 3C)
6. `TIME_LOGS` (Phase 3D)
7. `ACTIVITY` (Phase 4A)
8. `HOUR_BLOCKS` (Phase 4B)
9. `LEADS` (Phase 4C)
10. `MESSAGING` (Phase 4E)

---

## Migration Commands Quick Reference

```bash
# Export from Supabase
npx tsx scripts/migrate/export-supabase.ts

# Transform data
npx tsx scripts/migrate/transform-data.ts

# Import to Convex
npx tsx scripts/migrate/import-convex.ts

# Validate migration
npx tsx scripts/migrate/validate-migration.ts

# Run Convex dev
npx convex dev

# Deploy Convex
npx convex deploy
```
