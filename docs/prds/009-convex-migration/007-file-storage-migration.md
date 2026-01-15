# File Storage Migration Plan

**Goal:** Migrate all files from Supabase Storage to Convex Storage to fully decommission Supabase.

---

## Overview

Currently, files are stored in Supabase Storage with paths referenced in the database:
- **User avatars**: `user-avatars` bucket → `users.avatarUrl`
- **Task attachments**: `task-attachments` bucket → `taskAttachments.storagePath`

After this migration:
- Files will be in Convex Storage
- Records will reference Convex storage IDs
- Supabase Storage can be decommissioned

---

## Migration Strategy

### Phase 1: Schema Update (Add Storage ID Fields)

Add Convex storage ID fields alongside existing path fields:

```typescript
// users table
avatarUrl: v.optional(v.string()),        // Existing: Supabase path
avatarStorageId: v.optional(v.id("_storage")), // NEW: Convex storage ID

// taskAttachments table
storagePath: v.string(),                   // Existing: Supabase path
storageId: v.optional(v.id("_storage")),  // NEW: Convex storage ID
```

This allows:
- Existing code to keep working with paths
- New uploads to use Convex storage
- Gradual migration of existing files

### Phase 2: Update Upload Functions

Modify upload functions to use Convex storage:

```typescript
// New avatar upload flow
1. Client calls generateUploadUrl()
2. Client uploads file to Convex storage
3. Client calls saveAvatar({ userId, storageId })
4. Server stores storageId AND generates URL for avatarUrl (backwards compat)

// New attachment upload flow
1. Client calls generateUploadUrl({ taskId })
2. Client uploads file to Convex storage
3. Client calls saveAttachment({ taskId, storageId, originalName, mimeType, fileSize })
4. Server stores storageId AND keeps storagePath for backwards compat
```

### Phase 3: Migrate Existing Files

Create migration script to:

1. **List all files to migrate**
   - Query users with `avatarUrl` but no `avatarStorageId`
   - Query taskAttachments with `storagePath` but no `storageId`

2. **For each file:**
   ```
   a. Download from Supabase Storage
   b. Upload to Convex Storage (get storageId)
   c. Update record with new storageId
   d. Verify file accessible via Convex
   ```

3. **Track progress**
   - Log to `migrationRuns` table
   - Support resuming if interrupted

### Phase 4: Update Read Functions

After all files migrated, update functions to prefer Convex storage:

```typescript
// getAvatarUrl
if (user.avatarStorageId) {
  return await ctx.storage.getUrl(user.avatarStorageId);
}
// Fallback to Supabase path (during transition)
return user.avatarUrl;
```

### Phase 5: Cleanup

After verifying all files work:

1. Remove Supabase path fields from schema
2. Remove Supabase Storage proxy routes
3. Remove Supabase Storage SDK code
4. Decommission Supabase project

---

## Implementation Checklist

### Schema Update
- [ ] Add `avatarStorageId` to users table
- [ ] Add `storageId` to taskAttachments table
- [ ] Add index for `by_avatarStorageId` if needed
- [ ] Deploy schema: `npx convex deploy`

### Upload Function Updates
- [ ] Update `convex/storage/avatars.ts` for Convex storage
- [ ] Update `convex/storage/attachments.ts` for Convex storage
- [ ] Update client-side upload components
- [ ] Test new uploads work with Convex storage

### Migration Script
- [ ] Create `scripts/migrate/migrate-files.ts`
- [ ] Implement Supabase download logic
- [ ] Implement Convex upload logic
- [ ] Add progress tracking and resume capability
- [ ] Test with sample files

### File Migration Execution
- [ ] Count files to migrate (avatars + attachments)
- [ ] Run migration in batches
- [ ] Verify migrated files accessible
- [ ] Log any failures for retry

### Read Function Updates
- [ ] Update `getAvatarUrl` to use storageId
- [ ] Update `getAttachmentUrl` to use storageId
- [ ] Update proxy routes to prefer Convex storage
- [ ] Test all file access paths

### Cleanup
- [ ] Remove `avatarUrl` field from users schema
- [ ] Remove `storagePath` field from taskAttachments schema
- [ ] Remove Supabase proxy route handlers
- [ ] Remove `@supabase/supabase-js` if no longer needed
- [ ] Archive/delete Supabase Storage buckets

---

## Migration Script Design

```typescript
// scripts/migrate/migrate-files.ts

interface FileMigrationRecord {
  type: 'avatar' | 'attachment';
  recordId: string;
  supabasePath: string;
  convexStorageId?: string;
  status: 'pending' | 'downloaded' | 'uploaded' | 'verified' | 'failed';
  error?: string;
}

async function migrateAvatars() {
  // 1. Get all users with avatarUrl but no avatarStorageId
  const usersToMigrate = await convex.query(api.migration.queries.getUsersNeedingAvatarMigration);

  for (const user of usersToMigrate) {
    try {
      // 2. Download from Supabase
      const fileBuffer = await downloadFromSupabase('user-avatars', user.avatarUrl);

      // 3. Upload to Convex
      const uploadUrl = await convex.mutation(api.storage.avatars.generateUploadUrl);
      const storageId = await uploadToConvex(uploadUrl, fileBuffer);

      // 4. Update user record
      await convex.mutation(api.migration.mutations.setUserAvatarStorageId, {
        userId: user._id,
        storageId,
      });

      console.log(`✅ Migrated avatar for user ${user.email}`);
    } catch (error) {
      console.error(`❌ Failed to migrate avatar for ${user.email}:`, error);
      // Log to migration tracking
    }
  }
}

async function migrateAttachments() {
  // Similar pattern for task attachments
}
```

---

## File Counts (Estimate Before Migration)

Run these queries to understand scope:

```sql
-- Supabase: Count avatars
SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'user-avatars';

-- Supabase: Count attachments
SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'task-attachments';

-- Convex: Users with avatars
-- (Run via Convex dashboard or query)
```

---

## Rollback Plan

If file migration fails:

1. **Keep Supabase running** - Don't delete until verified
2. **Dual-read capability** - Functions check both storageId and path
3. **Revert schema** - Remove storageId fields if needed
4. **Restore proxy routes** - Re-enable Supabase paths

---

## Timeline Recommendation

1. **After Phase 3 (Tasks) complete** - All core data migrated
2. **Before Phase 5 (Cleanup)** - File migration is part of cleanup
3. **Can run in parallel** - File migration doesn't block feature work

---

## Dependencies

- Convex Storage enabled (included in all plans)
- Supabase service role key (for downloading files)
- Sufficient Convex storage quota
- Network bandwidth for transfer
