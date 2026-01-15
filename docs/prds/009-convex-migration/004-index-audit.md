# Index Audit

**Status:** Phase 1 Deliverable - Complete before Phase 2

This document maps all existing Supabase/Drizzle queries to required Convex indexes. Complete this audit to ensure the Convex schema has all necessary indexes before migrating data.

---

## Audit Process

1. Review each query file in `lib/queries/`
2. Identify the query patterns (WHERE clauses, ORDER BY)
3. Map to Convex index requirements
4. Verify index exists in `convex/schema.ts`

---

## Query Files to Audit

### lib/queries/clients/ (8 files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `access.ts` | `WHERE user_id = ?` | `clientMembers.by_user` | [ ] |
| `access.ts` | `WHERE client_id = ?` | `clientMembers.by_client` | [ ] |
| `settings.ts` | `WHERE id = ?` | Default `_id` | [ ] |
| `members.ts` | `WHERE client_id = ? AND user_id = ?` | `clientMembers.by_client_user` | [ ] |
| `users.ts` | TBD | TBD | [ ] |
| `slug.ts` | `WHERE slug = ?` | `clients.by_slug` | [ ] |
| `metrics.ts` | TBD | TBD | [ ] |
| `selectors.ts` | TBD | TBD | [ ] |
| `list.ts` | `WHERE deleted_at IS NULL` | `clients.by_deleted` | [ ] |
| `pagination.ts` | TBD | TBD | [ ] |

### lib/queries/users/ (8 files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `base.ts` | `WHERE id = ?` | Default `_id` | [ ] |
| `base.ts` | `WHERE email = ?` | `users.by_email` | [ ] |
| `fields.ts` | TBD | TBD | [ ] |
| `assignments.ts` | `WHERE user_id = ?` | `taskAssignees.by_user` | [ ] |
| `settings.ts` | TBD | TBD | [ ] |
| `mutations.ts` | N/A (mutations) | N/A | [ ] |
| `avatars.ts` | TBD | TBD | [ ] |

### lib/queries/projects/ (4 files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `slugs.ts` | `WHERE slug = ?` | `projects.by_slug` | [ ] |
| `slugs.ts` | `WHERE client_id = ? AND slug = ?` | `projects.by_client` + filter | [ ] |
| `metrics.ts` | `WHERE project_id = ?` | Various | [ ] |
| `listing.ts` | `WHERE client_id = ?` | `projects.by_client` | [ ] |
| `listing.ts` | `WHERE type = ?` | `projects.by_type` | [ ] |
| `listing.ts` | `WHERE created_by_id = ?` | `projects.by_createdBy` | [ ] |
| `listing-helpers.ts` | TBD | TBD | [ ] |

### lib/queries/tasks/ (4 files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `common.ts` | `WHERE project_id = ?` | `tasks.by_project` | [ ] |
| `common.ts` | `WHERE project_id = ? AND status = ?` | `tasks.by_project_status` | [ ] |
| `common.ts` | `WHERE project_id = ? AND status = ? ORDER BY rank` | `tasks.by_project_status_rank` | [ ] |
| `summaries.ts` | TBD | TBD | [ ] |
| `basic.ts` | `WHERE id = ?` | Default `_id` | [ ] |
| `relations.ts` | `WHERE task_id = ?` | `taskAssignees.by_task` | [ ] |
| `relations.ts` | `WHERE task_id = ?` | `taskComments.by_task` | [ ] |
| `relations.ts` | `WHERE task_id = ?` | `taskAttachments.by_task` | [ ] |

### lib/queries/time-logs/ (3 files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `read.ts` | `WHERE project_id = ?` | `timeLogs.by_project` | [ ] |
| `read.ts` | `WHERE user_id = ?` | `timeLogs.by_user` | [ ] |
| `read.ts` | `WHERE date = ?` | `timeLogs.by_date` | [ ] |
| `read.ts` | `WHERE project_id = ? AND date >= ? AND date <= ?` | `timeLogs.by_project_date` | [ ] |
| `read.ts` | `WHERE user_id = ? AND date >= ? AND date <= ?` | `timeLogs.by_user_date` | [ ] |
| `mutations.ts` | N/A (mutations) | N/A | [ ] |
| `aggregates.ts` | Aggregation queries | Verify index coverage | [ ] |

### lib/queries/contacts/ (4+ files)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `search.ts` | `WHERE email = ?` | `contacts.by_email` | [ ] |
| `search.ts` | `WHERE company = ?` | `contacts.by_company` | [ ] |
| `selectors.ts` | TBD | TBD | [ ] |
| `settings.ts` | TBD | TBD | [ ] |
| `list.ts` | `WHERE deleted_at IS NULL` | `contacts.by_deleted` | [ ] |

### lib/queries/ (root level)

| File | Query Pattern | Required Convex Index | Status |
|------|--------------|----------------------|--------|
| `hour-blocks.ts` | `WHERE client_id = ?` | `hourBlocks.by_client` | [ ] |
| `hour-blocks.ts` | `WHERE is_active = true` | `hourBlocks.by_active` | [ ] |
| `hour-blocks.ts` | `WHERE client_id = ? AND is_active = true` | `hourBlocks.by_client_active` | [ ] |
| `task-attachments.ts` | `WHERE task_id = ?` | `taskAttachments.by_task` | [ ] |
| `task-comments.ts` | `WHERE task_id = ?` | `taskComments.by_task` | [ ] |
| `task-comments.ts` | `WHERE parent_id = ?` | `taskComments.by_parent` | [ ] |
| `messages.ts` | `WHERE thread_id = ?` | `messages.by_thread` | [ ] |
| `threads.ts` | `WHERE status = ?` | `threads.by_status` | [ ] |
| `suggestions.ts` | `WHERE message_id = ?` | `suggestions.by_message` | [ ] |
| `suggestions.ts` | `WHERE type = ? AND status = ?` | `suggestions.by_type_status` | [ ] |

---

## Schema Index Verification

All required indexes have been verified in `convex/schema.ts`:

### users
- [x] `by_email` - `["email"]`
- [x] `by_authId` - `["authId"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### clients
- [x] `by_slug` - `["slug"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### clientMembers
- [x] `by_client` - `["clientId"]`
- [x] `by_user` - `["userId"]`
- [x] `by_client_user` - `["clientId", "userId"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### projects
- [x] `by_client` - `["clientId"]`
- [x] `by_slug` - `["slug"]`
- [x] `by_type` - `["type"]`
- [x] `by_status` - `["status"]`
- [x] `by_createdBy` - `["createdById"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_client_deleted` - `["clientId", "deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### tasks
- [x] `by_project` - `["projectId"]`
- [x] `by_project_status` - `["projectId", "status"]`
- [x] `by_project_status_rank` - `["projectId", "status", "rank"]`
- [x] `by_dueDate` - `["dueDate"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### taskAssignees
- [x] `by_task` - `["taskId"]`
- [x] `by_user` - `["userId"]`
- [x] `by_task_user` - `["taskId", "userId"]`
- [x] `by_user_deleted` - `["userId", "deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### taskComments
- [x] `by_task` - `["taskId"]`
- [x] `by_author` - `["authorId"]`
- [x] `by_parent` - `["parentId"]`
- [x] `by_task_deleted` - `["taskId", "deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### taskAttachments
- [x] `by_task` - `["taskId"]`
- [x] `by_uploadedBy` - `["uploadedById"]`
- [x] `by_storageId` - `["storageId"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### timeLogs
- [x] `by_project` - `["projectId"]`
- [x] `by_user` - `["userId"]`
- [x] `by_date` - `["date"]`
- [x] `by_project_date` - `["projectId", "date"]`
- [x] `by_user_date` - `["userId", "date"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### hourBlocks
- [x] `by_client` - `["clientId"]`
- [x] `by_active` - `["isActive"]`
- [x] `by_client_active` - `["clientId", "isActive"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### leads
- [x] `by_status` - `["status"]`
- [x] `by_email` - `["email"]`
- [x] `by_assignedTo` - `["assignedToId"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### contacts
- [x] `by_email` - `["email"]`
- [x] `by_company` - `["company"]`
- [x] `by_deleted` - `["deletedAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### activityLogs
- [x] `by_actor` - `["actorId"]`
- [x] `by_entityType` - `["entityType"]`
- [x] `by_entityId` - `["entityId"]`
- [x] `by_eventType` - `["eventType"]`
- [x] `by_createdAt` - `["createdAt"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### threads
- [x] `by_status` - `["status"]`
- [x] `by_providerId` - `["providerId"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### messages
- [x] `by_thread` - `["threadId"]`
- [x] `by_source` - `["source"]`
- [x] `by_sentAt` - `["sentAt"]`
- [x] `by_providerId` - `["providerId"]`
- [x] `by_supabaseId` - `["supabaseId"]`

### suggestions
- [x] `by_message` - `["messageId"]`
- [x] `by_task` - `["taskId"]`
- [x] `by_type` - `["type"]`
- [x] `by_status` - `["status"]`
- [x] `by_type_status` - `["type", "status"]`
- [x] `by_supabaseId` - `["supabaseId"]`

---

## Missing Indexes

Document any indexes needed that aren't in the schema:

| Table | Index Name | Fields | Query Pattern |
|-------|-----------|--------|---------------|
| | | | |

---

## Notes

- Convex indexes must cover the exact fields used in `withIndex()` queries
- Post-index filtering (via `.filter()`) is less efficient but acceptable for small result sets
- Consider compound indexes for frequently used query patterns
- `_supabaseId` indexes are temporary for migration and can be removed in Phase 5
