# PRD 009: Supabase to Convex Migration

## Executive Summary

This document outlines a **feature-by-feature migration** from Supabase (PostgreSQL + Auth + Storage) to Convex, enabling real-time capabilities for upcoming chat features while minimizing risk to existing functionality.

### Migration Strategy: Feature-by-Feature with Dual-Database Period

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION TIMELINE                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1        Phase 2        Phase 3        Phase 4        Phase 5    │
│  ────────       ────────       ────────       ────────       ────────   │
│  Setup &        Auth           Core Data      Remaining      Cleanup    │
│  Foundation     Migration      Migration      Features       & Sunset   │
│                                                                          │
│  [Convex Init]  [Convex Auth]  [Clients]      [Activity]     [Remove    │
│  [Schema]       [Google OAuth] [Projects]     [Hour Blocks]   Supabase] │
│  [Infra]        [Sessions]     [Tasks]        [Leads/CRM]               │
│                 [Storage]      [Time Logs]    [Messaging]               │
│                                [Comments]                                │
│                                                                          │
│  ◄─────────────── Dual Database Period ───────────────────────────────► │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth Provider** | Convex Auth + Google OAuth | Native integration, simpler than external providers |
| **Migration Style** | Feature-by-feature | Lowest risk, allows validation at each step |
| **Dual-write Period** | Yes, during transition | Enables rollback and gradual cutover |
| **Data Sync** | One-time migration per feature | Simpler than continuous sync; test with prod data copy |

---

## Current State Analysis

### Supabase Usage Summary

| Component | Count | Files Affected |
|-----------|-------|----------------|
| Database Tables | 26 | `lib/db/schema.ts` |
| Enums | 11 | `lib/db/schema.ts` |
| Query Files | 47 | `lib/queries/` |
| Data Layer Files | 17 | `lib/data/` |
| API Routes | 74 | `app/api/` |
| Supabase Imports | 55 files | Throughout codebase |
| Storage Buckets | 2 | `user-avatars`, `task-attachments` |

### Database Tables by Domain

**Core Domain (14 tables):**
- `users`, `clients`, `projects`, `tasks`
- `hour_blocks`, `time_logs`, `time_log_tasks`
- `task_assignees`, `task_assignee_metadata`
- `task_comments`, `task_attachments`
- `client_members`
- `activity_logs`, `activity_overview_cache`

**CRM Domain (4 tables):**
- `leads`, `contacts`
- `contact_clients`, `contact_leads`

**Integration Domain (2 tables):**
- `oauth_connections`, `github_repo_links`

**Messaging Domain (3 tables - Phase 5):**
- `threads`, `messages`, `suggestions`

### Current Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT AUTH FLOW (Supabase)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User clicks "Sign in with Google"                          │
│     └──► Supabase Auth initiates OAuth                         │
│                                                                 │
│  2. Google redirects to callback                               │
│     └──► Supabase validates & creates session                  │
│                                                                 │
│  3. Session stored in HTTP-only cookies                        │
│     └──► getSession() retrieves from cookies                   │
│                                                                 │
│  4. User profile synced to PostgreSQL                          │
│     └──► ensureUserProfile() creates/updates record            │
│                                                                 │
│  5. Role from user_metadata.role                               │
│     └──► ADMIN or CLIENT (default: CLIENT)                     │
│                                                                 │
│  Files: lib/auth/session.ts, lib/auth/profile.ts               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Current Storage Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 CURRENT STORAGE FLOW (Supabase)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Upload:                                                        │
│  1. File uploaded to pending folder                            │
│     └──► avatars/pending/{actorId}/ or                         │
│          attachments/pending/{actorId}/                         │
│                                                                 │
│  2. On success, metadata saved to database                     │
│     └──► task_attachments table (storagePath, mimeType, size)  │
│                                                                 │
│  3. File moved to final location                               │
│     └──► avatars/{userId}/ or attachments/tasks/{taskId}/      │
│                                                                 │
│  Retrieval:                                                     │
│  1. API route checks permissions                               │
│  2. Generates signed URL (or streams directly)                 │
│  3. Returns file to client                                     │
│                                                                 │
│  Buckets:                                                       │
│  - user-avatars: 2MB max, images only                          │
│  - task-attachments: 50MB max, images/videos/docs              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Target State: Convex Architecture

### Convex Data Model

```typescript
// convex/schema.ts - Target schema structure

// Enums become union types
export const taskStatus = v.union(
  v.literal("BACKLOG"),
  v.literal("ON_DECK"),
  v.literal("IN_PROGRESS"),
  v.literal("IN_REVIEW"),
  v.literal("BLOCKED"),
  v.literal("DONE"),
  v.literal("ARCHIVED")
);

export const userRole = v.union(
  v.literal("ADMIN"),
  v.literal("CLIENT")
);

// Tables become documents with validators
defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: userRole,
    deletedAt: v.optional(v.number()), // Unix timestamp for soft deletes
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_deleted", ["deletedAt"]),

  clients: defineTable({
    name: v.string(),
    slug: v.string(),
    billingType: v.union(v.literal("prepaid"), v.literal("net_30")),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_deleted", ["deletedAt"]),

  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    type: v.union(v.literal("CLIENT"), v.literal("PERSONAL"), v.literal("INTERNAL")),
    status: v.union(
      v.literal("ONBOARDING"),
      v.literal("ACTIVE"),
      v.literal("ON_HOLD"),
      v.literal("COMPLETED")
    ),
    clientId: v.optional(v.id("clients")), // Optional for PERSONAL/INTERNAL
    createdById: v.id("users"),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_client", ["clientId"])
    .index("by_slug", ["slug"])
    .index("by_type", ["type"])
    .index("by_deleted", ["deletedAt"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: taskStatus,
    rank: v.string(), // For ordering within status
    projectId: v.id("projects"),
    dueDate: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_deleted", ["deletedAt"]),

  // ... additional tables following same pattern
});
```

### Convex Auth Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET AUTH FLOW (Convex)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User clicks "Sign in with Google"                          │
│     └──► Convex Auth initiates OAuth via signIn()              │
│                                                                 │
│  2. Google redirects to Convex callback                        │
│     └──► Convex validates & creates session                    │
│                                                                 │
│  3. Session managed by Convex (automatic)                      │
│     └──► useConvexAuth() hook provides state                   │
│                                                                 │
│  4. User document in Convex                                    │
│     └──► Created automatically on first auth                   │
│                                                                 │
│  5. Role stored in user document                               │
│     └──► Checked in queries/mutations via ctx.auth             │
│                                                                 │
│  Files: convex/auth.ts, convex/auth.config.ts                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Convex Storage Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                 TARGET STORAGE FLOW (Convex)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Upload:                                                        │
│  1. Client calls mutation to get upload URL                    │
│     └──► generateUploadUrl() returns signed URL                │
│                                                                 │
│  2. Client uploads directly to Convex storage                  │
│     └──► POST to signed URL with file                          │
│                                                                 │
│  3. Client calls mutation with storageId                       │
│     └──► Link file to document (task, user, etc.)              │
│                                                                 │
│  Retrieval:                                                     │
│  1. Query includes storageId reference                         │
│  2. getUrl() generates access URL                              │
│  3. URL returned with document data                            │
│                                                                 │
│  Benefits:                                                      │
│  - Built-in CDN                                                │
│  - Automatic cleanup when documents deleted                    │
│  - Same permission model as data                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Phases

### Phase 1: Setup & Foundation

**Objective:** Set up Convex project, define schema, establish development workflow

**Tasks:**

1. **Initialize Convex Project**
   ```bash
   npm install convex
   npx convex init
   ```

2. **Configure Development Environment**
   - Set up Convex dashboard project
   - Configure environment variables
   - Set up local development with `npx convex dev`

3. **Define Convex Schema**
   - Translate all 26 tables to Convex document types
   - Define validators for all 11 enum types
   - Set up indexes for common query patterns
   - Create schema.ts with full type definitions

4. **Set Up Convex Functions Structure**
   ```
   convex/
   ├── _generated/          # Auto-generated types
   ├── schema.ts            # Schema definitions
   ├── auth.ts              # Auth configuration
   ├── auth.config.ts       # Provider setup
   ├── users/               # User queries/mutations
   ├── clients/             # Client queries/mutations
   ├── projects/            # Project queries/mutations
   ├── tasks/               # Task queries/mutations
   ├── storage/             # File upload/download
   └── lib/                 # Shared utilities
       ├── permissions.ts   # Access control helpers
       └── validators.ts    # Shared validators
   ```

5. **Create Data Migration Scripts**
   - Script to export Supabase data to JSON
   - Script to import JSON to Convex
   - Validation script to compare data integrity

**Deliverables:**
- [ ] Convex project initialized and connected
- [ ] Complete schema.ts with all tables
- [ ] Index definitions for query performance
- [ ] Migration script framework
- [ ] Development workflow documented

**Files Created:**
- `convex/schema.ts`
- `convex/lib/permissions.ts`
- `convex/lib/validators.ts`
- `scripts/migrate/export-supabase.ts`
- `scripts/migrate/import-convex.ts`
- `scripts/migrate/validate-migration.ts`

---

### Phase 2: Auth Migration

**Objective:** Replace Supabase Auth with Convex Auth + Google OAuth

**Tasks:**

1. **Configure Convex Auth**
   ```typescript
   // convex/auth.config.ts
   import Google from "@auth/core/providers/google";
   import { convexAuth } from "@convex-dev/auth/server";

   export const { auth, signIn, signOut, store } = convexAuth({
     providers: [
       Google({
         clientId: process.env.GOOGLE_CLIENT_ID,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
       }),
     ],
   });
   ```

2. **Create Auth Hooks and Components**
   - `useConvexUser()` - Replace `getCurrentUser()`
   - `<ConvexAuthProvider>` - Replace `<SupabaseListener>`
   - `<SignInButton>` - Google OAuth button
   - `<SignOutButton>` - Sign out action

3. **Migrate Permission System**
   - Port `lib/auth/permissions.ts` to Convex
   - Create `convex/lib/permissions.ts` with same API
   - Implement role-based checks using ctx.auth

4. **Create Auth Compatibility Layer**
   ```typescript
   // lib/auth/convex-session.ts
   // Provides same API as session.ts but uses Convex
   export async function getCurrentUser() {
     // During migration: try Convex first, fall back to Supabase
   }
   ```

5. **Migrate User Storage**
   - Export existing users from Supabase
   - Import to Convex users table
   - Map Supabase user IDs to Convex document IDs
   - Create ID mapping table for reference during migration

6. **Update Sign-in/Sign-out Flows**
   - Replace Supabase OAuth routes
   - Update callback handlers
   - Test session persistence

7. **Migrate File Storage**
   - Set up Convex file storage
   - Create upload mutation for avatars
   - Create upload mutation for task attachments
   - Migrate existing files from Supabase Storage
   - Update file retrieval routes

**Deliverables:**
- [ ] Convex Auth configured with Google OAuth
- [ ] All users migrated to Convex
- [ ] Permission system ported
- [ ] Auth compatibility layer working
- [ ] File storage migrated
- [ ] Sign-in/sign-out flows updated

**Files Modified:**
- `lib/auth/session.ts` → Compatibility layer
- `lib/auth/permissions.ts` → Convex version
- `components/providers/` → New Convex providers
- `app/(auth)/` → Updated auth pages

**Files Created:**
- `convex/auth.ts`
- `convex/auth.config.ts`
- `convex/users/queries.ts`
- `convex/users/mutations.ts`
- `convex/storage/avatars.ts`
- `convex/storage/attachments.ts`
- `lib/convex/auth.ts` (client-side hooks)

**Rollback Plan:**
- Keep Supabase Auth active during migration
- Feature flag to switch between auth providers
- If issues arise, disable Convex Auth flag

---

### Phase 3: Core Data Migration

**Objective:** Migrate core business data: clients, projects, tasks, time logs, comments

**Migration Order:**
```
clients → client_members → projects → tasks → task_assignees
       → task_assignee_metadata → task_comments → task_attachments
       → time_logs → time_log_tasks
```

**Sub-phases:**

#### Phase 3A: Clients & Access Control

**Tasks:**

1. **Create Convex Client Functions**
   ```typescript
   // convex/clients/queries.ts
   export const list = query({
     handler: async (ctx) => {
       const user = await requireAuth(ctx);
       if (isAdmin(user)) {
         return ctx.db.query("clients")
           .filter(q => q.eq(q.field("deletedAt"), undefined))
           .collect();
       }
       // Non-admin: filter by membership
       const memberships = await ctx.db.query("client_members")
         .withIndex("by_user", q => q.eq("userId", user._id))
         .collect();
       // ... fetch clients by IDs
     },
   });
   ```

2. **Migrate client_members Table**
   - Critical for permission system
   - Must preserve user-to-client relationships

3. **Create Dual-Read Layer**
   ```typescript
   // lib/data/clients/index.ts
   export async function fetchClients() {
     if (USE_CONVEX_CLIENTS) {
       return convexClient.query(api.clients.list);
     }
     return supabaseClientList(); // Existing implementation
   }
   ```

4. **Migrate Existing Data**
   - Export clients from Supabase
   - Transform to Convex format
   - Import to Convex
   - Validate counts and integrity

**Deliverables:**
- [ ] Clients migrated to Convex
- [ ] Client members migrated
- [ ] Dual-read layer working
- [ ] Permission checks passing

#### Phase 3B: Projects

**Tasks:**

1. **Create Convex Project Functions**
   - `projects/queries.ts` - List, get by slug, get by ID
   - `projects/mutations.ts` - Create, update, archive

2. **Handle Project Types**
   - CLIENT projects: linked to client
   - PERSONAL projects: created by user, visible only to creator
   - INTERNAL projects: visible to all team members

3. **Migrate project_users Table** (if exists)
   - Project-specific access beyond client membership

4. **Update Data Layer**
   - `lib/data/projects/` functions to use Convex
   - Preserve complex assembly logic

**Deliverables:**
- [ ] Projects migrated to Convex
- [ ] Project permissions working
- [ ] Slug-based routing working

#### Phase 3C: Tasks & Related

**Tasks:**

1. **Create Convex Task Functions**
   - Complex queries with status filtering
   - Rank-based ordering within status
   - Due date handling

2. **Migrate Task Relationships**
   - task_assignees (N-to-N with users)
   - task_assignee_metadata (sort order)
   - task_comments (threading support)
   - task_attachments (file references)

3. **Handle Task Board Operations**
   - Kanban drag-and-drop (rank updates)
   - Status transitions
   - Batch operations

4. **Real-time Task Updates** (New Capability!)
   - Convex subscriptions for live board updates
   - Optimistic updates on mutations

**Deliverables:**
- [ ] Tasks migrated to Convex
- [ ] All task relationships working
- [ ] Board operations functional
- [ ] Real-time updates enabled

#### Phase 3D: Time Tracking

**Tasks:**

1. **Create Convex Time Log Functions**
   - time_logs with task associations
   - time_log_tasks junction table
   - Aggregation queries for reporting

2. **Migrate Check Constraint Logic**
   - `time_log_task_matches_project()` - Validate task belongs to project
   - Implement as mutation validation

3. **Update Time Entry UI**
   - Timer functionality
   - Manual entry
   - Editing and deletion

**Deliverables:**
- [ ] Time logs migrated to Convex
- [ ] Task associations working
- [ ] Validation logic implemented
- [ ] Reporting queries functional

---

### Phase 4: Remaining Features

**Objective:** Migrate remaining tables and features

#### Phase 4A: Activity System

**Tables:** `activity_logs`, `activity_overview_cache`

**Tasks:**
1. Port activity event handlers to Convex
2. Migrate activity logs
3. Update cache computation logic
4. Connect activity feeds to Convex queries

#### Phase 4B: Hour Blocks

**Tables:** `hour_blocks`

**Tasks:**
1. Create Convex functions for prepaid hours
2. Migrate existing hour block data
3. Update dashboard widgets
4. Connect to time tracking for burn-down

#### Phase 4C: Leads & CRM

**Tables:** `leads`, `contacts`, `contact_clients`, `contact_leads`

**Tasks:**
1. Create Convex functions for lead pipeline
2. Migrate lead Kanban board to Convex
3. Update lead intake webhook to write to Convex
4. Migrate contact management

#### Phase 4D: Integrations

**Tables:** `oauth_connections`, `github_repo_links`

**Tasks:**
1. Migrate OAuth token storage (encrypted)
2. Update GitHub repo linking
3. Update Google/GitHub OAuth flows
4. Test refresh token handling

#### Phase 4E: Messaging (Phase 5 Tables)

**Tables:** `threads`, `messages`, `suggestions`

**Tasks:**
1. Migrate existing email/messaging data
2. Set up real-time message subscriptions
3. Update AI suggestion workflow
4. **Prepare foundation for chat features**

**Deliverables:**
- [ ] Activity system migrated
- [ ] Hour blocks migrated
- [ ] CRM/Leads migrated
- [ ] Integrations migrated
- [ ] Messaging migrated

---

### Phase 5: Cleanup & Supabase Sunset

**Objective:** Remove Supabase dependencies, clean up migration artifacts

**Tasks:**

1. **Remove Dual-Read/Write Code**
   - Delete Supabase query implementations
   - Remove feature flags
   - Clean up compatibility layers

2. **Remove Supabase Packages**
   ```bash
   npm uninstall @supabase/supabase-js @supabase/ssr
   ```

3. **Archive Supabase Configuration**
   - Move Drizzle schema to archive folder
   - Keep migrations for reference
   - Document original architecture

4. **Clean Up Environment Variables**
   - Remove Supabase-related env vars
   - Update deployment configurations
   - Update CI/CD pipelines

5. **Delete Supabase Files**
   - `lib/supabase/` directory
   - `lib/db/` (Drizzle ORM)
   - `drizzle/` migrations folder
   - Supabase type definitions

6. **Final Validation**
   - Full regression testing
   - Performance benchmarking
   - Security audit
   - Monitor for issues

7. **Decommission Supabase**
   - Final data export/backup
   - Disable Supabase project
   - (Keep for rollback window if needed)

**Deliverables:**
- [ ] All Supabase code removed
- [ ] Dependencies cleaned up
- [ ] Environment variables updated
- [ ] Final validation complete
- [ ] Supabase project archived

---

## Data Migration Strategy

### Production Data Copy to Dev Convex

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA MIGRATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Production Supabase                                            │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │ Export Script   │  scripts/migrate/export-supabase.ts       │
│  │ - Query all tables                                          │
│  │ - Export to JSON                                            │
│  │ - Include relationships                                     │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Transform Script│  scripts/migrate/transform-data.ts        │
│  │ - Map IDs (UUID → Convex ID)                                │
│  │ - Convert timestamps                                        │
│  │ - Validate data                                             │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Import Script   │  scripts/migrate/import-convex.ts         │
│  │ - Create in dependency order                                │
│  │ - Preserve relationships                                    │
│  │ - Generate ID mapping                                       │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  Dev Convex Instance                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ID Mapping Strategy

Supabase uses UUIDs, Convex uses internal document IDs. We need a mapping:

```typescript
// scripts/migrate/id-mapping.ts
interface IdMapping {
  [table: string]: {
    [supabaseId: string]: ConvexId;
  };
}

// Store mapping during migration
const mapping: IdMapping = {
  users: {
    "uuid-1234-...": "j57x2y...", // Convex ID
  },
  clients: { ... },
  projects: { ... },
  // ...
};
```

### Migration Order (Dependency-Based)

```
1. users (no dependencies)
2. clients (no dependencies)
3. client_members (depends: users, clients)
4. projects (depends: clients, users)
5. tasks (depends: projects)
6. task_assignees (depends: tasks, users)
7. task_assignee_metadata (depends: task_assignees)
8. task_comments (depends: tasks, users)
9. task_attachments (depends: tasks, users) + file migration
10. time_logs (depends: projects, users)
11. time_log_tasks (depends: time_logs, tasks)
12. hour_blocks (depends: clients)
13. leads (depends: none)
14. contacts (depends: none)
15. contact_clients (depends: contacts, clients)
16. contact_leads (depends: contacts, leads)
17. oauth_connections (depends: users)
18. github_repo_links (depends: projects)
19. activity_logs (depends: various)
20. activity_overview_cache (depends: activity_logs)
21. threads (depends: none)
22. messages (depends: threads)
23. suggestions (depends: messages, tasks)
```

### File Migration

**Avatar Files:**
1. List all files in `user-avatars` bucket
2. Download each file
3. Upload to Convex storage
4. Update user document with new storageId

**Task Attachments:**
1. Query `task_attachments` table for file paths
2. Download each file from `task-attachments` bucket
3. Upload to Convex storage
4. Update attachment document with new storageId

```typescript
// scripts/migrate/migrate-files.ts
async function migrateAvatars(idMapping: IdMapping) {
  const { data: files } = await supabase.storage
    .from('user-avatars')
    .list('avatars');

  for (const file of files) {
    const { data } = await supabase.storage
      .from('user-avatars')
      .download(file.name);

    const storageId = await convex.storage.store(data);

    // Update user document
    const convexUserId = idMapping.users[extractUserId(file.name)];
    await convex.mutation(api.users.updateAvatar, {
      userId: convexUserId,
      storageId,
    });
  }
}
```

---

## Testing Strategy

### Local Development Testing

1. **Export production data to JSON**
2. **Import to local Convex dev instance**
3. **Run full application locally**
4. **Compare behavior with production**

### Feature Testing Checklist

For each migrated feature:

- [ ] Data integrity validated
- [ ] CRUD operations working
- [ ] Permissions enforced correctly
- [ ] Real-time updates working (where applicable)
- [ ] Error handling appropriate
- [ ] Performance acceptable
- [ ] No regressions in UI

### Dual-Read Validation

During dual-database period:
- Read from both databases
- Compare results
- Log discrepancies
- Alert on mismatches

```typescript
// lib/data/dual-read.ts
export async function dualReadClients() {
  const [supabaseClients, convexClients] = await Promise.all([
    fetchSupabaseClients(),
    fetchConvexClients(),
  ]);

  // Compare and log differences
  const diff = compareDatasets(supabaseClients, convexClients);
  if (diff.length > 0) {
    console.warn('Data mismatch detected:', diff);
    // Alert to monitoring
  }

  // Return Convex data (primary) during migration
  return convexClients;
}
```

---

## Rollback Strategy

### Feature-Level Rollback

Each phase can be rolled back independently:

1. **Flip feature flag** to use Supabase implementation
2. **No data sync needed** - Supabase data unchanged
3. **Investigate and fix** issues
4. **Re-attempt** migration

### Full Rollback

If major issues discovered:

1. **Disable all Convex feature flags**
2. **Revert to Supabase-only** code path
3. **Supabase data remains source of truth**
4. **Convex data discarded** (can re-migrate later)

### Feature Flag Structure

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
```

---

## Risk Assessment

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auth session issues | Users locked out | Keep Supabase Auth as fallback |
| Data loss during migration | Critical | Pre-migration backup, validation scripts |
| Permission bugs | Security breach | Extensive testing, gradual rollout |
| Performance regression | User experience | Benchmark before/after, Convex indexes |

### Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Real-time complexity | Feature delays | Start simple, iterate |
| ID mapping errors | Broken relationships | Validation scripts, foreign key checks |
| Storage migration | Lost files | Keep Supabase storage until validated |

### Low Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Learning curve | Development speed | Team training, documentation |
| Convex limitations | Feature constraints | Research edge cases early |

---

## Success Metrics

### Migration Success

- [ ] Zero data loss
- [ ] Zero security regressions
- [ ] All features functional
- [ ] Performance equal or better
- [ ] Real-time features enabled

### Post-Migration

- [ ] Chat features can be built on Convex
- [ ] Development velocity maintained
- [ ] No Supabase dependencies remaining
- [ ] Cost comparison favorable

---

## Appendix A: Table Mapping Reference

| Supabase Table | Convex Collection | Notes |
|----------------|-------------------|-------|
| users | users | Role from user_metadata → document field |
| clients | clients | Direct mapping |
| client_members | clientMembers | Camel case convention |
| projects | projects | Direct mapping |
| tasks | tasks | rank field preserved |
| task_assignees | taskAssignees | Soft delete preserved |
| task_assignee_metadata | taskAssigneeMetadata | Sort order |
| task_comments | taskComments | Threading support |
| task_attachments | taskAttachments | storageId reference |
| time_logs | timeLogs | Direct mapping |
| time_log_tasks | timeLogTasks | Junction table |
| hour_blocks | hourBlocks | Direct mapping |
| leads | leads | Direct mapping |
| contacts | contacts | Direct mapping |
| contact_clients | contactClients | Junction table |
| contact_leads | contactLeads | Junction table |
| oauth_connections | oauthConnections | Encrypted tokens |
| github_repo_links | githubRepoLinks | Direct mapping |
| activity_logs | activityLogs | JSONB → object field |
| activity_overview_cache | activityCache | Cache recomputation |
| threads | threads | Direct mapping |
| messages | messages | Direct mapping |
| suggestions | suggestions | Direct mapping |

---

## Appendix B: Enum Mapping Reference

```typescript
// Supabase enums → Convex validators

// taskStatus
v.union(
  v.literal("BACKLOG"),
  v.literal("ON_DECK"),
  v.literal("IN_PROGRESS"),
  v.literal("IN_REVIEW"),
  v.literal("BLOCKED"),
  v.literal("DONE"),
  v.literal("ARCHIVED")
)

// userRole
v.union(v.literal("ADMIN"), v.literal("CLIENT"))

// clientBillingType
v.union(v.literal("prepaid"), v.literal("net_30"))

// projectType
v.union(v.literal("CLIENT"), v.literal("PERSONAL"), v.literal("INTERNAL"))

// projectStatus
v.union(
  v.literal("ONBOARDING"),
  v.literal("ACTIVE"),
  v.literal("ON_HOLD"),
  v.literal("COMPLETED")
)

// leadStatus
v.union(
  v.literal("NEW_OPPORTUNITIES"),
  v.literal("ACTIVE_OPPORTUNITIES"),
  v.literal("PROPOSAL_SENT"),
  v.literal("ON_ICE"),
  v.literal("CLOSED_WON"),
  v.literal("CLOSED_LOST"),
  v.literal("UNQUALIFIED")
)

// leadSourceType
v.union(v.literal("REFERRAL"), v.literal("WEBSITE"), v.literal("EVENT"))

// oauthProvider
v.union(v.literal("GOOGLE"), v.literal("GITHUB"))

// oauthConnectionStatus
v.union(
  v.literal("ACTIVE"),
  v.literal("EXPIRED"),
  v.literal("REVOKED"),
  v.literal("PENDING_REAUTH")
)

// messageSource
v.union(
  v.literal("EMAIL"),
  v.literal("CHAT"),
  v.literal("VOICE_MEMO"),
  v.literal("DOCUMENT"),
  v.literal("FORM")
)

// threadStatus
v.union(v.literal("OPEN"), v.literal("RESOLVED"), v.literal("ARCHIVED"))

// suggestionType
v.union(v.literal("TASK"), v.literal("PR"), v.literal("REPLY"))

// suggestionStatus
v.union(
  v.literal("DRAFT"),
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
  v.literal("MODIFIED"),
  v.literal("FAILED")
)
```

---

## Appendix C: API Route Migration Reference

| Current Route | Action | Migration Notes |
|---------------|--------|-----------------|
| POST /api/auth/google | OAuth init | → Convex Auth |
| GET /api/auth/callback/google | OAuth callback | → Convex Auth |
| POST /api/uploads/user-avatar | File upload | → Convex storage mutation |
| POST /api/uploads/task-attachment | File upload | → Convex storage mutation |
| GET /api/storage/* | File retrieval | → Convex storage URL |
| GET/POST /api/projects | CRUD | → Convex query/mutation |
| GET/POST /api/clients | CRUD | → Convex query/mutation |
| POST /api/tasks/* | CRUD | → Convex mutation |
| POST /api/integrations/leads-intake | Webhook | Keep as API route, write to Convex |

---

## Next Steps

1. **Review this plan** with team
2. **Set up Convex project** (Phase 1 start)
3. **Create detailed task breakdown** for Phase 1
4. **Begin schema definition** in Convex

Ready to proceed with Phase 1 when approved.
