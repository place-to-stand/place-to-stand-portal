# PRD 010: Manual Test Plan

> Updated after each coding session. Test cases are added as features are implemented.
> Mark tests ✅ when passing, ❌ when failing, ⏭️ when not yet testable.

## Phase 1: Data Model

### Schema & Migration
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | `transcriptSource` enum exists with value `DRIVE_SEARCH` | ⏭️ | |
| 1.2 | `transcriptClassification` enum exists with values `UNCLASSIFIED`, `CLASSIFIED`, `DISMISSED` | ⏭️ | |
| 1.3 | `transcripts` table exists with all columns from spec | ⏭️ | |
| 1.4 | `classification` column defaults to `UNCLASSIFIED` | ⏭️ | |
| 1.5 | `participantNames` and `participantEmails` default to empty arrays | ⏭️ | |
| 1.6 | Unique partial index on `driveFileId` (WHERE `deleted_at IS NULL`) prevents duplicate Drive docs | ⏭️ | |
| 1.7 | Index on `classification` exists for filtered list queries | ⏭️ | |
| 1.8 | FK constraints exist for `clientId`, `projectId`, `leadId`, `classifiedBy`, `syncedBy` | ⏭️ | |
| 1.9 | Relations defined in `lib/db/relations.ts` for transcripts <-> clients, projects, leads, users | ⏭️ | |
| 1.10 | Migration applies cleanly: `npm run db:migrate` | ⏭️ | |
| 1.11 | `npm run type-check` passes after schema changes | ⏭️ | |

### Behavioral Rules (Query Layer)
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 1.12 | Setting `clientId` on transcript auto-sets `classification = CLASSIFIED`, `classifiedBy`, `classifiedAt` | ⏭️ | |
| 1.13 | Setting `projectId` on transcript auto-sets `classification = CLASSIFIED` | ⏭️ | |
| 1.14 | Setting `leadId` on transcript auto-sets `classification = CLASSIFIED` | ⏭️ | |
| 1.15 | Removing all links (clientId, projectId, leadId all NULL) reverts to `UNCLASSIFIED`, clears `classifiedBy`/`classifiedAt` | ⏭️ | |
| 1.16 | Removing one link while another remains keeps `CLASSIFIED` | ⏭️ | |
| 1.17 | Dismissing clears `clientId`, `projectId`, `leadId` and sets `DISMISSED` | ⏭️ | |
| 1.18 | Setting `leadId` clears `clientId` and `projectId` (mutual exclusivity) | ⏭️ | |
| 1.19 | Setting `clientId` clears `leadId` (mutual exclusivity) | ⏭️ | |
| 1.20 | `clientId` and `projectId` can coexist | ⏭️ | |

## Phase 2: Drive Sync

### Discovery
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.1 | `discoverTranscriptsFromDrive()` runs all 3 search queries (Gemini Notes, Transcript, Meeting notes) | ⏭️ | |
| 2.2 | Results are deduped by Drive file ID across queries | ⏭️ | |
| 2.3 | Content is extracted via Google Docs API for each discovered document | ⏭️ | |
| 2.4 | Participant names are parsed from transcript content (speaker labels) | ⏭️ | |
| 2.5 | Meeting date is extracted from document title when possible | ⏭️ | |
| 2.6 | Meeting date falls back to `createdTime` when title parsing fails | ⏭️ | |
| 2.7 | 200ms delay between Docs API content fetches is respected | ⏭️ | |
| 2.8 | Max 50 documents processed per sync run | ⏭️ | |
| 2.9 | Result counts per query are logged for drift detection | ⏭️ | |
| 2.10 | Search query patterns are stored as named constants (not hardcoded inline) | ⏭️ | |

### Sync Orchestrator
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.11 | `syncTranscriptsForUser()` inserts new transcripts with `classification = UNCLASSIFIED` | ⏭️ | |
| 2.12 | New transcripts have `syncedBy` set to the syncing user | ⏭️ | |
| 2.13 | Re-running sync does not create duplicate records (dedup by `driveFileId`) | ⏭️ | |
| 2.14 | Modified documents have their `content` and `title` updated | ⏭️ | |
| 2.15 | Unchanged documents are skipped | ⏭️ | |
| 2.16 | `lastTranscriptSyncAt` is updated in `oauthConnections.syncState` | ⏭️ | |
| 2.17 | Sync returns correct counts: `discovered`, `created`, `updated`, `skipped`, `errors` | ⏭️ | |

### Error Handling
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.18 | Connection missing Drive/Docs scopes is skipped with warning log | ⏭️ | |
| 2.19 | Revoked OAuth token marks `needsReauth: true` in syncState | ⏭️ | |
| 2.20 | Drive API 429 (quota exceeded) logs error, does NOT update `lastTranscriptSyncAt` | ⏭️ | |
| 2.21 | Single document content extraction failure does not abort entire sync | ⏭️ | |
| 2.22 | Empty content extraction inserts transcript with `content: null` | ⏭️ | |

### Multi-User Dedup
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.23 | User A syncs a document, User B's sync sees it already exists and skips | ⏭️ | |
| 2.24 | Unique constraint on `driveFileId` is handled gracefully (no crash) | ⏭️ | |

### Cron & Manual Trigger
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.25 | `GET /api/cron/transcript-sync` requires `CRON_SECRET` Bearer auth | ⏭️ | |
| 2.26 | Cron iterates all active Google OAuth connections | ⏭️ | |
| 2.27 | `POST /api/integrations/transcripts/sync` requires authenticated admin user | ⏭️ | |
| 2.28 | Manual sync returns results summary to caller | ⏭️ | |
| 2.29 | Transcript-sync cron added to `vercel.json` at `*/15 * * * *` | ⏭️ | |

## Phase 3: Remove Lead Auto-Linking

### Code Removal
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 3.1 | `generate-suggestions.ts` no longer creates LINK_EMAIL_THREAD suggestions | ⏭️ | |
| 3.2 | `generate-suggestions.ts` no longer creates LINK_TRANSCRIPT suggestions | ⏭️ | |
| 3.3 | AI action suggestions (FOLLOW_UP, REPLY, etc.) still generate correctly | ⏭️ | |
| 3.4 | `lead-email-suggestions-section.tsx` is deleted | ⏭️ | |
| 3.5 | `lead-transcript-suggestions-section.tsx` is deleted | ⏭️ | |
| 3.6 | `LeadActionType` no longer includes `LINK_EMAIL_THREAD` or `LINK_TRANSCRIPT` | ⏭️ | |
| 3.7 | `SuggestedContent` union no longer includes link types | ⏭️ | |

### Verification
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 3.8 | Lead sheet right column renders without email/transcript suggestion sections | ⏭️ | |
| 3.9 | Open a lead, generate suggestions — only action suggestions appear | ⏭️ | |
| 3.10 | `npm run type-check` passes (no errors from removed types) | ⏭️ | |
| 3.11 | `npm run build` passes (no import errors from deleted files) | ⏭️ | |
| 3.12 | Existing LINK_EMAIL_THREAD / LINK_TRANSCRIPT rows in DB cause no runtime errors | ⏭️ | |

## Phase 4a: Transcript AI Classification

### Classification Function
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4a.1 | `classifyTranscript()` returns `clientMatches` and `leadMatches` arrays | ⏭️ | |
| 4a.2 | Results with confidence < 0.4 are filtered out | ⏭️ | |
| 4a.3 | Structured output validated via Zod schema | ⏭️ | |
| 4a.4 | Uses `google/gemini-3-flash` via AI Gateway | ⏭️ | |
| 4a.5 | System prompt is adapted for transcript context (title, participants, content) | ⏭️ | |
| 4a.6 | Leads are included alongside clients/projects in a single prompt | ⏭️ | |

### Analyze Endpoint
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4a.7 | `GET /api/transcripts/{id}/analyze` returns cached results when `aiAnalyzedAt` is set | ⏭️ | |
| 4a.8 | `GET /api/transcripts/{id}/analyze` returns `analyzed: false` when `aiAnalyzedAt` is NULL | ⏭️ | |
| 4a.9 | `POST /api/transcripts/{id}/analyze` runs AI and stores results in cache fields | ⏭️ | |
| 4a.10 | POST returns cached result when `aiAnalyzedAt` is already set (no AI call) | ⏭️ | |
| 4a.11 | POST with `{ force: true }` re-runs AI even when cache exists | ⏭️ | |
| 4a.12 | Top client match stored in `aiSuggestedClientId`/`aiSuggestedClientName`/`aiSuggestedProjectId`/`aiSuggestedProjectName` | ⏭️ | |
| 4a.13 | Top lead match stored in `aiSuggestedLeadId`/`aiSuggestedLeadName` | ⏭️ | |
| 4a.14 | `aiConfidence` stores the confidence of the top match | ⏭️ | |
| 4a.15 | `aiAnalyzedAt` is set to current timestamp after analysis | ⏭️ | |
| 4a.16 | Both GET and POST require admin authentication | ⏭️ | |

### Auto-Analyze on Sync (wired after Phase 4a)
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4a.17 | New transcripts from sync are auto-analyzed after Phase 4a is wired in | ⏭️ | |
| 4a.18 | Failed auto-analysis does not prevent transcript creation | ⏭️ | |
| 4a.19 | Rate limit of 500ms between AI calls during sync is respected | ⏭️ | |

## Phase 4b: Email Classification Alignment

> **Caution:** This refactors production email triage. Test independently.

### AI Prompt Changes
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4b.1 | `classifyEmailThread()` accepts `leads` parameter | ⏭️ | |
| 4b.2 | Leads are included in system prompt and user prompt | ⏭️ | |
| 4b.3 | Response includes `leadMatches` alongside `clientMatches` and `projectMatches` | ⏭️ | |
| 4b.4 | Zod response schema updated to include lead matches | ⏭️ | |

### No Regression
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4b.5 | Email triage (DB matchers) still works identically — `suggestClientMatch()` unchanged | ⏭️ | |
| 4b.6 | `suggestLeadMatch()` still works identically — not modified | ⏭️ | |
| 4b.7 | `app/api/triage/route.ts` is NOT modified | ⏭️ | |
| 4b.8 | Email AI analysis returns lead matches alongside client/project matches | ⏭️ | |
| 4b.9 | Existing classified threads are unaffected | ⏭️ | |
| 4b.10 | Confidence scores and thresholds behave correctly for AI lead matches | ⏭️ | |

## Phase 5: Inbox UI — Transcripts Tab

### Tab & Navigation
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.1 | Transcripts tab appears in inbox tab bar (after Triage and Emails) | ⏭️ | |
| 5.2 | Transcripts tab is hidden for non-admin (CLIENT role) users | ⏭️ | |
| 5.3 | Transcripts tab badge shows unclassified transcript count | ⏭️ | |
| 5.4 | `/my/inbox/transcripts` defaults to unclassified view | ⏭️ | |
| 5.5 | `/my/inbox/transcripts/classified` shows classified transcripts | ⏭️ | |
| 5.6 | `/my/inbox/transcripts/dismissed` shows dismissed transcripts | ⏭️ | |

### Transcript List View
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.7 | Sub-tabs show correct counts: Unclassified (N), Classified (N), Dismissed (N) | ⏭️ | |
| 5.8 | Transcript rows show: title, meeting date, participant names, AI suggestion badge | ⏭️ | |
| 5.9 | AI suggestion badge format: "AI: ClientName -> ProjectName (85%)" or "AI: Lead -> LeadName (72%)" | ⏭️ | |
| 5.10 | Transcript rows do NOT load `content` column (performance — list query excludes it) | ⏭️ | |
| 5.11 | "Load more" pagination works | ⏭️ | |
| 5.12 | Search bar filters transcripts by title/participant names | ⏭️ | |

### Transcript Row Actions
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.13 | "Classify" button opens classification panel | ⏭️ | |
| 5.14 | "Dismiss" button dismisses the transcript (clears links, sets DISMISSED) | ⏭️ | |
| 5.15 | Classified transcripts show entity badge instead of action buttons | ⏭️ | |
| 5.16 | Classified transcripts show "Edit" button to reclassify | ⏭️ | |
| 5.17 | "Analyze" button appears only when `aiAnalyzedAt` is NULL | ⏭️ | |
| 5.18 | "Re-analyze" button appears for already-analyzed transcripts | ⏭️ | |

### Transcript Detail Panel
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.19 | Clicking a transcript row opens detail panel/sheet | ⏭️ | |
| 5.20 | Detail panel shows full transcript text (content loaded on expand) | ⏭️ | |
| 5.21 | Detail panel shows meeting metadata: date, duration, participants | ⏭️ | |
| 5.22 | Link to original Google Doc (`driveFileUrl`) is clickable | ⏭️ | |
| 5.23 | Classification panel is accessible from detail view | ⏭️ | |

### Classification Panel
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.24 | Three tracks available: Client, Internal, Lead | ⏭️ | |
| 5.25 | AI suggestions pre-populate dropdowns (client, project, or lead) | ⏭️ | |
| 5.26 | Selecting lead track disables client/project fields (mutual exclusivity) | ⏭️ | |
| 5.27 | Selecting client track disables lead field (mutual exclusivity) | ⏭️ | |
| 5.28 | Submitting classification calls `PATCH /api/transcripts/{id}` | ⏭️ | |
| 5.29 | Classify as client -> sets clientId, optionally projectId, classification = CLASSIFIED | ⏭️ | |
| 5.30 | Classify as lead -> sets leadId, clears clientId/projectId, classification = CLASSIFIED | ⏭️ | |
| 5.31 | Dismiss -> clears all links, sets classification = DISMISSED | ⏭️ | |

### Eager AI Analysis on Load
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.32 | Loading transcript list fires analyze calls for visible transcripts where `aiAnalyzedAt` is NULL | ⏭️ | |
| 5.33 | Analyze calls are non-blocking — list renders immediately, badges update on completion | ⏭️ | |
| 5.34 | Already-analyzed transcripts return cached results instantly (no extra AI tokens) | ⏭️ | |
| 5.35 | Analyze calls are batched (max 5 concurrent) to avoid flooding | ⏭️ | |
| 5.36 | Same eager analysis pattern works on email triage page for unanalyzed threads | ⏭️ | |

### Checkbox Hit Area
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.37 | Triage row checkbox is easily clickable (expanded hit area via padding) | ⏭️ | |
| 5.38 | Thread row (email list) checkbox has same expanded hit area | ⏭️ | |
| 5.39 | Transcript row checkbox has same expanded hit area | ⏭️ | |
| 5.40 | Expanded hit area does not shift row layout or overlap adjacent elements | ⏭️ | |

### Sync Controls
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.41 | Triage tab sync triggers both email and transcript sync | ⏭️ | |
| 5.42 | Triage tab transcript sync is fire-and-forget (non-blocking) | ⏭️ | |
| 5.43 | Triage tab auto-syncs: emails every 60s, transcripts every 5min | ⏭️ | |
| 5.44 | Emails tab sync triggers email sync only | ⏭️ | |
| 5.45 | Transcripts tab sync triggers transcript sync only | ⏭️ | |
| 5.46 | Transcripts tab auto-syncs every 60s | ⏭️ | |
| 5.47 | Manual sync shows toast with results ("N new transcripts found") | ⏭️ | |

### Batch Actions
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.48 | `POST /api/transcripts/batch` with `{ ids, action: 'dismiss' }` dismisses multiple transcripts | ⏭️ | |
| 5.49 | `POST /api/transcripts/batch` with `{ action: 'dismiss_before', before: timestamp }` dismisses all unclassified before date | ⏭️ | |
| 5.50 | Bulk dismiss uses `COALESCE(meeting_date, created_at)` for transcripts with NULL meetingDate | ⏭️ | |
| 5.51 | "Dismiss older than..." dropdown shows options: 1 week, 1 month, 3 months, 6 months, 1 year | ⏭️ | |

### API Endpoints
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.52 | `GET /api/transcripts` returns paginated list (content column excluded) | ⏭️ | |
| 5.53 | `GET /api/transcripts` supports query params: classification, clientId, projectId, leadId, search, limit, offset | ⏭️ | |
| 5.54 | `PATCH /api/transcripts/{id}` enforces mutual exclusivity invariants | ⏭️ | |
| 5.55 | All transcript API endpoints require admin authentication | ⏭️ | |

## Phase 5b: Context Surfacing

### Client Detail Page
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5b.1 | Transcripts section appears on client detail page (right column, below emails) | ⏭️ | |
| 5b.2 | Section shows up to 5 most recent transcripts classified to that client | ⏭️ | |
| 5b.3 | "+N more" link shown when more than 5 transcripts exist | ⏭️ | |
| 5b.4 | Each row shows: title, participant names, meeting date, link to Google Doc | ⏭️ | |
| 5b.5 | `content` column is NOT fetched by `getTranscriptsForClient()` | ⏭️ | |
| 5b.6 | Classify transcript to client -> appears on that client's detail page | ⏭️ | |
| 5b.7 | Dismiss/unclassify transcript -> removed from client detail page | ⏭️ | |

### Lead Sheet
| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5b.8 | Transcripts section appears on lead sheet right column (after Meetings) | ⏭️ | |
| 5b.9 | Section uses React Query to fetch via `GET /api/leads/{leadId}/transcripts` | ⏭️ | |
| 5b.10 | Each row shows: title, participant names, meeting date, link to Google Doc | ⏭️ | |
| 5b.11 | Expanding a row shows content preview (first ~500 chars, lazy-loaded) | ⏭️ | |
| 5b.12 | `content` column is NOT fetched in list response | ⏭️ | |
| 5b.13 | `GET /api/leads/{leadId}/transcripts` requires admin authentication | ⏭️ | |
| 5b.14 | Classify transcript to lead -> appears on that lead's sheet | ⏭️ | |
| 5b.15 | Dismiss/unclassify transcript -> removed from lead sheet | ⏭️ | |

## Edge Cases (Cross-Phase)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| E.1 | Classified transcript disappears from unclassified list on refresh | ⏭️ | |
| E.2 | Dismissed transcript appears in dismissed view | ⏭️ | |
| E.3 | Transcript with only `projectId` (no `clientId`) still counts as CLASSIFIED | ⏭️ | |
| E.4 | Transcript with `content: null` (failed extraction) can still be classified by title/participants | ⏭️ | |
| E.5 | Soft-deleted transcript (`deletedAt` set) does not appear in any view | ⏭️ | |
| E.6 | Unique partial index allows re-inserting a Drive doc after soft delete | ⏭️ | |
| E.7 | Rapidly clicking classify/dismiss doesn't cause double mutations | ⏭️ | |
| E.8 | Non-admin user accessing `/my/inbox/transcripts` is rejected | ⏭️ | |
| E.9 | Non-admin user accessing transcript API endpoints gets 403 | ⏭️ | |
| E.10 | Transcript classified to client shows on client page, reclassified to lead -> moves to lead sheet, removed from client page | ⏭️ | |
