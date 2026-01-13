# Migration Checklist

Quick reference for tracking migration progress.

## Key Decisions Summary

| Decision | Choice |
|----------|--------|
| Auth Provider | Convex Auth + Google OAuth |
| Migration Style | Feature-by-feature |
| Dual Database | Yes, during transition |
| Feature Flags | Per-feature toggles |

---

## Phase 1: Setup & Foundation

### Environment Setup
- [ ] Install Convex: `npm install convex @convex-dev/auth`
- [ ] Initialize project: `npx convex init`
- [ ] Set up Convex dashboard project
- [ ] Configure environment variables
- [ ] Verify `npx convex dev` works

### Schema Definition
- [ ] Create `convex/schema.ts`
- [ ] Define all 11 enum validators
- [ ] Define all 26 document tables
- [ ] Add indexes for query patterns
- [ ] Add `_supabaseId` migration fields
- [ ] Validate schema compiles

### Migration Scripts
- [ ] Create `scripts/migrate/export-supabase.ts`
- [ ] Create `scripts/migrate/transform-data.ts`
- [ ] Create `scripts/migrate/import-convex.ts`
- [ ] Create `scripts/migrate/validate-migration.ts`
- [ ] Test export from dev Supabase
- [ ] Test import to dev Convex

### Project Structure
- [ ] Create `convex/lib/permissions.ts`
- [ ] Create `convex/lib/validators.ts`
- [ ] Create `convex/lib/softDelete.ts`
- [ ] Create `lib/feature-flags.ts`

---

## Phase 2: Auth Migration

### Convex Auth Setup
- [ ] Create `convex/auth.ts`
- [ ] Create `convex/auth.config.ts`
- [ ] Configure Google OAuth provider
- [ ] Set Google Client ID/Secret in Convex

### User Migration
- [ ] Export users from Supabase
- [ ] Import users to Convex
- [ ] Create ID mapping file
- [ ] Verify user count matches

### Auth Components
- [ ] Create `<ConvexAuthProvider>`
- [ ] Create `<SignInButton>`
- [ ] Create `<SignOutButton>`
- [ ] Create `useConvexUser()` hook

### Compatibility Layer
- [ ] Create `lib/auth/convex-session.ts`
- [ ] Implement `getCurrentUser()` wrapper
- [ ] Implement `requireUser()` wrapper
- [ ] Implement `requireRole()` wrapper

### Permission System
- [ ] Port `isAdmin()` to Convex
- [ ] Port `assertAdmin()` to Convex
- [ ] Port `ensureClientAccess()` to Convex
- [ ] Port `listAccessibleClientIds()` to Convex

### Storage Migration
- [ ] Create `convex/storage/avatars.ts`
- [ ] Create `convex/storage/attachments.ts`
- [ ] Migrate avatar files
- [ ] Migrate task attachment files
- [ ] Update upload routes

### Testing
- [ ] Test Google OAuth sign-in
- [ ] Test session persistence
- [ ] Test sign-out
- [ ] Test protected routes
- [ ] Test file uploads
- [ ] Test file retrieval

### Rollback Ready
- [ ] Feature flag `USE_CONVEX_AUTH` working
- [ ] Can toggle back to Supabase Auth
- [ ] Both auth systems functional

---

## Phase 3A: Clients & Access Control

### Convex Functions
- [ ] Create `convex/clients/queries.ts`
- [ ] Create `convex/clients/mutations.ts`
- [ ] Implement `list` query (with permissions)
- [ ] Implement `getBySlug` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `archive` mutation

### Data Migration
- [ ] Export clients from Supabase
- [ ] Import to Convex
- [ ] Export client_members from Supabase
- [ ] Import to Convex
- [ ] Validate relationships

### Dual-Read Layer
- [ ] Update `lib/data/clients/` to use Convex
- [ ] Feature flag `USE_CONVEX_CLIENTS`
- [ ] Test with flag enabled
- [ ] Test with flag disabled

### Testing
- [ ] Client list loads correctly
- [ ] Client detail page works
- [ ] Client creation works
- [ ] Client editing works
- [ ] Client archiving works
- [ ] Non-admin sees only their clients
- [ ] Admin sees all clients

---

## Phase 3B: Projects

### Convex Functions
- [ ] Create `convex/projects/queries.ts`
- [ ] Create `convex/projects/mutations.ts`
- [ ] Implement `list` query (with type filtering)
- [ ] Implement `getBySlug` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `archive` mutation

### Data Migration
- [ ] Export projects from Supabase
- [ ] Import to Convex
- [ ] Validate client relationships

### Dual-Read Layer
- [ ] Update `lib/data/projects/` to use Convex
- [ ] Feature flag `USE_CONVEX_PROJECTS`

### Testing
- [ ] PROJECT type filtering works
- [ ] PERSONAL projects only visible to creator
- [ ] INTERNAL projects visible to all
- [ ] CLIENT projects respect membership
- [ ] Slug-based routing works

---

## Phase 3C: Tasks

### Convex Functions
- [ ] Create `convex/tasks/queries.ts`
- [ ] Create `convex/tasks/mutations.ts`
- [ ] Implement `listByProject` query
- [ ] Implement `getById` query
- [ ] Implement `create` mutation
- [ ] Implement `update` mutation
- [ ] Implement `updateStatus` mutation
- [ ] Implement `reorder` mutation

### Related Tables
- [ ] Migrate task_assignees
- [ ] Migrate task_assignee_metadata
- [ ] Migrate task_comments
- [ ] Migrate task_attachments

### Real-time (New!)
- [ ] Add subscription for board updates
- [ ] Implement optimistic updates
- [ ] Test live collaboration

### Testing
- [ ] Kanban board renders
- [ ] Drag-and-drop works
- [ ] Status transitions work
- [ ] Task creation works
- [ ] Task editing works
- [ ] Comments work
- [ ] Attachments work

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

- [ ] Create `convex/activity/mutations.ts`
- [ ] Create `convex/activity/queries.ts`
- [ ] Migrate activity_logs
- [ ] Migrate activity_overview_cache
- [ ] Update event handlers
- [ ] Test activity feeds

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

## Phase 5: Cleanup

### Remove Supabase Code
- [ ] Remove all feature flags (enable Convex everywhere)
- [ ] Delete `lib/supabase/` directory
- [ ] Delete `lib/db/` directory (Drizzle)
- [ ] Delete `drizzle/` migrations folder
- [ ] Remove Supabase type definitions

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

### Final Validation
- [ ] Full regression test
- [ ] Performance benchmark
- [ ] Security review
- [ ] Monitor production for 1 week

### Archive
- [ ] Export final Supabase data backup
- [ ] Archive migration scripts
- [ ] Document migration lessons learned
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
```

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
