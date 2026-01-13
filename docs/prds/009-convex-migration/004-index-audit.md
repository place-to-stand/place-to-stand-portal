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

After completing the audit above, verify all required indexes exist in `convex/schema.ts`:

### users
- [ ] `by_email` - `["email"]`
- [ ] `by_authId` - `["authId"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### clients
- [ ] `by_slug` - `["slug"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### clientMembers
- [ ] `by_client` - `["clientId"]`
- [ ] `by_user` - `["userId"]`
- [ ] `by_client_user` - `["clientId", "userId"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### projects
- [ ] `by_client` - `["clientId"]`
- [ ] `by_slug` - `["slug"]`
- [ ] `by_type` - `["type"]`
- [ ] `by_status` - `["status"]`
- [ ] `by_createdBy` - `["createdById"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_client_deleted` - `["clientId", "deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### tasks
- [ ] `by_project` - `["projectId"]`
- [ ] `by_project_status` - `["projectId", "status"]`
- [ ] `by_project_status_rank` - `["projectId", "status", "rank"]`
- [ ] `by_dueDate` - `["dueDate"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### taskAssignees
- [ ] `by_task` - `["taskId"]`
- [ ] `by_user` - `["userId"]`
- [ ] `by_task_user` - `["taskId", "userId"]`
- [ ] `by_user_deleted` - `["userId", "deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### taskComments
- [ ] `by_task` - `["taskId"]`
- [ ] `by_author` - `["authorId"]`
- [ ] `by_parent` - `["parentId"]`
- [ ] `by_task_deleted` - `["taskId", "deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### taskAttachments
- [ ] `by_task` - `["taskId"]`
- [ ] `by_uploadedBy` - `["uploadedById"]`
- [ ] `by_storageId` - `["storageId"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### timeLogs
- [ ] `by_project` - `["projectId"]`
- [ ] `by_user` - `["userId"]`
- [ ] `by_date` - `["date"]`
- [ ] `by_project_date` - `["projectId", "date"]`
- [ ] `by_user_date` - `["userId", "date"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### hourBlocks
- [ ] `by_client` - `["clientId"]`
- [ ] `by_active` - `["isActive"]`
- [ ] `by_client_active` - `["clientId", "isActive"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### leads
- [ ] `by_status` - `["status"]`
- [ ] `by_email` - `["email"]`
- [ ] `by_assignedTo` - `["assignedToId"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### contacts
- [ ] `by_email` - `["email"]`
- [ ] `by_company` - `["company"]`
- [ ] `by_deleted` - `["deletedAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### activityLogs
- [ ] `by_actor` - `["actorId"]`
- [ ] `by_entityType` - `["entityType"]`
- [ ] `by_entityId` - `["entityId"]`
- [ ] `by_eventType` - `["eventType"]`
- [ ] `by_createdAt` - `["createdAt"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### threads
- [ ] `by_status` - `["status"]`
- [ ] `by_providerId` - `["providerId"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### messages
- [ ] `by_thread` - `["threadId"]`
- [ ] `by_source` - `["source"]`
- [ ] `by_sentAt` - `["sentAt"]`
- [ ] `by_providerId` - `["providerId"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

### suggestions
- [ ] `by_message` - `["messageId"]`
- [ ] `by_task` - `["taskId"]`
- [ ] `by_type` - `["type"]`
- [ ] `by_status` - `["status"]`
- [ ] `by_type_status` - `["type", "status"]`
- [ ] `by_supabaseId` - `["_supabaseId"]`

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
