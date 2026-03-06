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

Each query returns up to 100 results sorted by `modifiedTime desc`. Results are deduped by Drive file ID before processing. No `modifiedTime` filter is applied — dedup handles already-seen documents (see Sync Behavior).

**Implementation notes:**

- **Configurable constants:** Store these query patterns as named constants in `lib/google/transcript-discovery.ts` (not hardcoded inline). Google has changed Gemini branding before — centralizing makes updates easy.
- **Log result counts:** Each sync should log how many results each query returned (e.g., `[Transcript Sync] Gemini Notes: 12, Transcript: 3, Meeting notes: 5`). This makes it detectable if a query silently stops matching due to naming changes.
- **Known false positives:** The `name contains 'Transcript'` query will match any Google Doc with "Transcript" in the title (interview transcripts, legal transcripts, etc.). For a 4-person agency this produces minimal noise — false positives are handled by dismissing in the triage queue. If volume becomes a problem, narrow the query or add exclusion patterns.

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
  source: 'DRIVE_SEARCH'
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
  options?: { connectionId?: string }
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
  analyzed: number      // New transcripts auto-analyzed by AI
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

1. Call `discoverTranscriptsFromDrive(userId)` — fetches 50 most recent docs (no time filter)
2. For each discovered document:
   - Check if `driveFileId` exists in `transcripts` table
   - **New document**: insert with `classification: 'UNCLASSIFIED'`, `syncedBy: userId`
   - **Existing, content changed**: update `content`, `title`, `updatedAt`
   - **Existing, unchanged**: skip
3. Update `lastTranscriptSyncAt` in `oauthConnections.syncState` (for UI display only)
4. Return sync result

> **Auto-analyze** is wired in after Phase 4a ships (see below). Phase 2 initially creates transcripts without AI suggestions — users see "Analyze" buttons until auto-analyze is enabled.

### Multi-User Dedup

Multiple users may have Google OAuth connections. When the cron runs:

1. User A's sync discovers documents and inserts them (with `syncedBy: userA`)
2. User B's sync discovers the same documents — the `driveFileId` unique index prevents duplicates
3. The sync orchestrator handles the unique constraint gracefully (upsert or catch/skip)

This means the first user whose sync runs "claims" each transcript. All users can still view and classify all transcripts (global access).

> **Decision:** Sync state is per-connection (not global). Multiple users may redundantly discover the same Drive docs, but the unique constraint on `driveFileId` handles dedup cheaply. This avoids adding a global coordination mechanism.

### Sync Behavior

Each sync run fetches up to 50 documents sorted by `modifiedTime desc` (newest first) and deduplicates against existing records via the `driveFileId` unique constraint. There is no `since` time filter and no incremental sync mode — every run is identical:

- Fetch 50 most recent docs from Drive
- Skip any that already exist in the database (by `driveFileId`)
- Insert new documents, update changed ones
- The 50-doc cap protects against rate limits and timeouts

`lastTranscriptSyncAt` is tracked for display purposes only (showing "Last sync: 5 min ago" in the UI) — it is not used as a query filter.

This trades slightly more Drive API calls (always fetching 50 results even when there's nothing new) for dramatically simpler sync logic with no edge cases around timestamp management.

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

## Error Handling

The sync must gracefully handle API failures without corrupting state:

| Scenario | Behavior |
|----------|----------|
| Connection missing Drive/Docs scopes | Skip connection, log warning. Check `hasDocsScopes()` before attempting sync. |
| OAuth token revoked / expired | Mark `needsReauth: true` in syncState, skip connection. Surface reconnect banner in inbox UI. |
| Drive API quota exceeded (429) | Log error, do NOT update `lastTranscriptSyncAt` (retry next cycle). |
| Docs API failure for single doc | Log error, continue with remaining docs. Include in `errors[]` array of sync result. |
| Content extraction returns empty | Insert transcript with `content: null`. It can still be classified by title/participants. |

## Auto-Analyze on Sync (wired after Phase 4a)

Phase 2 ships without auto-analyze. Once Phase 4a delivers `classifyTranscript()`, a follow-up PR wires it into the sync flow:

After inserting a new transcript, call `classifyTranscript()` inline with a rate limit (one analysis per 500ms). If the analysis fails, the transcript is still created — it just shows an "Analyze" button instead of a pre-populated suggestion.

**Rate budget:** At ~1000 tokens per classification call on Gemini Flash, 50 transcripts per sync = ~50K tokens. Cheap enough to run inline.

Store results in the AI cache fields (`aiSuggested*`, `aiAnalyzedAt`) during the sync itself — no separate background job needed.

**Before Phase 4a ships:** Users see "Analyze" buttons on every transcript in the triage queue.
**After auto-analyze is wired:** New transcripts arrive pre-analyzed. Classification becomes a one-step process (confirm or override).

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

**Schedule:** `*/15 * * * *` (every 15 minutes, same cadence as Gmail sync). Add to `vercel.json` crons array.

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
   - Store search query patterns as named constants (not hardcoded)
   - Log result counts per query for drift detection
   - Extract and generalize Drive search from `lib/google/meet.ts:searchGeminiNotes()`
   - Extract content fetcher from `lib/google/meet.ts:fetchGeminiNotesContent()`
   - Add participant name extraction from transcript content
   - Add meeting date extraction from title
   - Check `hasDocsScopes()` before attempting API calls
2. Create `lib/transcripts/sync.ts` with `syncTranscriptsForUser()`
   - Dedup logic against existing `driveFileId` records (always dedup, no `since` filter)
   - Upsert for content changes
   - Sync state management
   - Error handling: scope checks, 429 handling, per-doc failure resilience
   - **After Phase 4a:** follow-up PR to wire auto-analyze into sync flow
3. Create `app/api/cron/transcript-sync/route.ts`
4. Create `app/api/integrations/transcripts/sync/route.ts`
5. Add transcript-sync cron to `vercel.json`: `*/15 * * * *`
6. Test: manual sync discovers Drive documents and creates transcript records
7. Test: re-running sync does not create duplicates
8. Test: modified documents have their content updated
9. Test: sync gracefully handles missing scopes, revoked tokens, API failures
