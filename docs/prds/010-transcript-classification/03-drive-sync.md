# 03: Google Drive Sync

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **2 — Drive Sync**
> Dependencies: [02-data-model.md](./02-data-model.md) (transcripts table must exist)

## Discovery Strategy

Rather than relying on the Meet API (which requires a `conferenceId` from a known meeting record), we search Google Drive directly for transcript-shaped documents. This catches transcripts from all meetings regardless of how they were scheduled.

### Search Queries

Three parallel Drive API queries, deduped by file ID:

| Query | Target |
|-------|--------|
| `name contains 'Notes by Gemini' AND mimeType='application/vnd.google-apps.document'` | Gemini auto-generated meeting notes |
| `name contains 'Transcript' AND mimeType='application/vnd.google-apps.document'` | Explicit transcript documents |
| `name contains 'Meeting notes' AND mimeType='application/vnd.google-apps.document'` | Manual meeting notes |

For incremental sync, add `AND modifiedTime > '{lastSyncTime}'` to each query.

Each query returns up to 100 results sorted by `modifiedTime desc`. Results are deduped by Drive file ID before processing.

### Content Extraction

For each discovered document:

1. **Metadata**: title, createdTime, modifiedTime, webViewLink from Drive API
2. **Content**: fetch full text via Google Docs API (`documents/{docId}`) — reuse the `extractTextFromGoogleDoc()` pattern from `lib/google/meet.ts`
3. **Participant extraction**: parse speaker labels from content (e.g., `[HH:MM] Name:` or `Name:` at line starts). Return as `participantNames[]`
4. **Meeting date**: try to extract from document title first (Gemini Notes use format `Title - YYYY/MM/DD HH:MM TZ - Notes by Gemini`), fall back to `createdTime`

### Rate Limiting

- Add 200ms delay between Docs API content fetches (content extraction is the expensive call)
- Process max 50 documents per sync run
- Skip content fetch for documents already in the database with unchanged `modifiedTime`

## Discovery Service

**New file:** `lib/google/transcript-discovery.ts`

```typescript
export type DiscoveredTranscript = {
  driveFileId: string
  driveFileUrl: string
  title: string
  content: string
  source: 'DRIVE_SEARCH' | 'GEMINI_NOTES'
  meetingDate: string | null  // ISO timestamp
  participantNames: string[]
  modifiedTime: string        // For change detection
}

/**
 * Search Google Drive for transcript/meeting notes documents.
 * Returns discovered documents deduped by file ID.
 */
export async function discoverTranscriptsFromDrive(
  userId: string,
  options?: { connectionId?: string; since?: Date }
): Promise<DiscoveredTranscript[]>
```

**Reuses:**
- `getValidAccessToken()` from `lib/gmail/client.ts` — OAuth token management
- Drive API search pattern from `lib/google/meet.ts:searchGeminiNotes()` — generalized for multiple queries
- `extractTextFromGoogleDoc()` pattern from `lib/google/meet.ts:fetchGeminiNotesContent()` — content extraction

## Sync Orchestrator

**New file:** `lib/transcripts/sync.ts`

```typescript
export type TranscriptSyncResult = {
  discovered: number    // Total docs found in Drive
  created: number       // New transcripts inserted
  updated: number       // Existing transcripts with updated content
  skipped: number       // Already up-to-date
  errors: string[]      // Any error messages
}

/**
 * Sync transcripts from Google Drive for a specific user.
 * Discovers documents, deduplicates against existing records, and upserts.
 */
export async function syncTranscriptsForUser(
  userId: string,
  options?: { connectionId?: string }
): Promise<TranscriptSyncResult>
```

### Sync Flow

1. Read `lastTranscriptSyncAt` from `oauthConnections.syncState`
2. Call `discoverTranscriptsFromDrive(userId, { since })` with last sync time
3. For each discovered document:
   - Check if `driveFileId` exists in `transcripts` table
   - **New document**: insert with `classification: 'UNCLASSIFIED'`, `syncedBy: userId`
   - **Existing, content changed**: update `content`, `title`, `updatedAt`
   - **Existing, unchanged**: skip
4. Update `lastTranscriptSyncAt` in `oauthConnections.syncState`
5. Return sync result

### Multi-User Dedup

Multiple users may have Google OAuth connections. When the cron runs:

1. User A's sync discovers documents and inserts them (with `syncedBy: userA`)
2. User B's sync discovers the same documents — the `driveFileId` unique index prevents duplicates
3. The sync orchestrator handles the unique constraint gracefully (upsert or catch/skip)

This means the first user whose sync runs "claims" each transcript. All users can still view and classify all transcripts (global access).

### Sync State

Extend the existing `oauthConnections.syncState` JSONB field:

```typescript
type GmailSyncState = {
  historyId?: string
  lastSyncAt?: string
  lastError?: string
  lastErrorAt?: string
  needsReauth?: boolean
  syncType?: 'full' | 'incremental'
  lastTranscriptSyncAt?: string  // NEW: last transcript sync time
  lastTranscriptError?: string   // NEW: last transcript sync error
}
```

## Cron Endpoint

**New file:** `app/api/cron/transcript-sync/route.ts`

Same pattern as `app/api/cron/gmail-sync/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // 1. Verify CRON_SECRET
  // 2. Fetch all active Google OAuth connections
  // 3. For each connection, call syncTranscriptsForUser()
  // 4. Return results summary
}
```

Authenticated via `Authorization: Bearer {CRON_SECRET}` header.

## Manual Sync Trigger

**New file:** `app/api/integrations/transcripts/sync/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate user (getCurrentUser)
  // 2. Verify Google OAuth connection exists
  // 3. Call syncTranscriptsForUser(user.id)
  // 4. Return sync results
}
```

Called from the inbox UI when the user clicks the "Sync" button on the Transcripts tab.

## Implementation Checklist (Phase 2)

1. Create `lib/google/transcript-discovery.ts` with `discoverTranscriptsFromDrive()`
   - Extract and generalize Drive search from `lib/google/meet.ts:searchGeminiNotes()`
   - Extract content fetcher from `lib/google/meet.ts:fetchGeminiNotesContent()`
   - Add participant name extraction from transcript content
   - Add meeting date extraction from title
2. Create `lib/transcripts/sync.ts` with `syncTranscriptsForUser()`
   - Dedup logic against existing `driveFileId` records
   - Upsert for content changes
   - Sync state management
3. Create `app/api/cron/transcript-sync/route.ts`
4. Create `app/api/integrations/transcripts/sync/route.ts`
5. Test: manual sync discovers Drive documents and creates transcript records
6. Test: re-running sync does not create duplicates
7. Test: modified documents have their content updated
