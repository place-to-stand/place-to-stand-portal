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
- [x] Define all 11 enum validators
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

> **✅ Phase 2 Status: READY FOR SHIP**
>
> All infrastructure is in place:
> - Convex Auth configured with Google OAuth
> - Users migrated (4 users, 10 clients, 25 projects, 143 tasks)
> - Permission system ported and validated (8/8 tests passed)
> - Feature flag enabled (`NEXT_PUBLIC_USE_CONVEX_AUTH=true`)
> - Build passes, type-check clean
>
> **Remaining before ship:**
> 1. Manual testing of OAuth flow (sign-in, session persistence, sign-out)
> 2. Pre-migration user communication (optional - can be done post-deploy)
> 3. Storage file migration (deferred to Phase 4F)

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
> **Status:** Auth flag is enabled. Manual testing required to verify full flow.

- [ ] Test Google OAuth sign-in (manual: visit /sign-in and click "Continue with Google")
- [ ] Test session persistence (manual: refresh page, verify still logged in)
- [ ] Test sign-out (manual: click sign out, verify redirected to /sign-in)
- [ ] Test protected routes (manual: access dashboard routes while authenticated)
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

### Convex Functions
- [ ] Create `convex/clients/queries.ts`
- [ ] Create `convex/clients/mutations.ts`
- [ ] Implement `list` query (with permissions)
- [ ] Implement `getBySlug` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `archive` mutation (with child check - block if has projects)
- [ ] Add uniqueness check in `clientMembers.create`

### Data Migration
- [ ] Export clients from Supabase
- [ ] Import to Convex
- [ ] Export client_members from Supabase
- [ ] Import to Convex
- [ ] Validate relationships
- [ ] Record migration in `migrationRuns` table

### Adapter Implementation
- [ ] Create `lib/data/adapters/clients-supabase.ts`
- [ ] Create `lib/data/adapters/clients-convex.ts`
- [ ] Both implement `ClientsAdapter` interface
- [ ] Update `lib/data/clients/` to use adapter

### Dual-Read Layer
- [ ] Update `lib/data/clients/` to use Convex
- [ ] Feature flag `USE_CONVEX_CLIENTS` (requires AUTH enabled)
- [ ] Test with flag enabled
- [ ] Test with flag disabled
- [ ] Add PostHog tracking for data source hits

### Testing
- [ ] Client list loads correctly
- [ ] Client detail page works
- [ ] Client creation works
- [ ] Client editing works
- [ ] Client archiving works
- [ ] Non-admin sees only their clients
- [ ] Admin sees all clients
- [ ] Permission parity validation passes

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
- [ ] Migrate activity_logs
- [ ] Migrate activity_overview_cache
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
