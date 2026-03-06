# 08: Context Surfacing

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **5b — Context Surfacing** (ships with or immediately after Phase 5)
> Dependencies: [02-data-model.md](./02-data-model.md), [03-drive-sync.md](./03-drive-sync.md)

## Why This Matters

Classification without surfacing is half the feature. Users classify transcripts into a void unless that context appears where they actually work: client pages, lead sheets, and project boards. This section defines the minimal v1 payoff — classified transcripts appear alongside existing email sections on entity detail pages.

## Client Detail Page

**File:** `app/(dashboard)/clients/[clientSlug]/_components/client-transcripts-section.tsx`

Mirrors the existing `client-emails-section.tsx` pattern:

- **Server-side data fetch**: query transcripts where `clientId` matches, sorted by `meetingDate DESC`
- **Card section** with microphone/transcript icon, badge showing total count
- Show up to 5 most recent transcripts, "+N more" link if more exist
- Each row: title, participant names (truncated), meeting date, link to Google Doc (`driveFileUrl`)
- Clicking a row opens the transcript detail panel or links to the inbox transcripts view

### Row Layout

```
  Weekly Sync - Client Team              Mar 5, 2026
  Jason, Sarah, Mike                     45 min
```

### Data Query

**New function:** `lib/queries/transcripts.ts`

```typescript
export type TranscriptForClient = {
  id: string
  title: string
  meetingDate: string | null
  durationMinutes: number | null
  participantNames: string[]
  driveFileUrl: string | null
}

export async function getTranscriptsForClient(
  clientId: string,
  options?: { limit?: number }
): Promise<TranscriptForClient[]>
```

**Important:** This query must NOT select the `content` column. Transcript content can be 40KB-120KB per row. List views should only fetch metadata.

### Placement

In `client-detail.tsx`, add `<ClientTranscriptsSection>` in the right column below the existing `<ClientEmailsSection>`:

```
Right Column:
  Projects
  Contacts
  Emails        <-- existing
  Transcripts   <-- NEW
```

## Lead Sheet Right Column

**File:** `app/(dashboard)/leads/_components/lead-sheet/lead-transcripts-section.tsx`

Mirrors the existing `lead-email-threads.tsx` pattern:

- **Client-side fetch with React Query**: `GET /api/leads/{leadId}/transcripts`
- Collapsible list of transcripts linked to this lead
- Each row: title, participant names, meeting date, link to Google Doc
- Expanding a row shows a content preview (first ~500 chars) — lazy-loaded

### API Endpoint

**New route:** `app/api/leads/[leadId]/transcripts/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  // 1. Auth + admin check
  // 2. Fetch transcripts where leadId matches
  // 3. Return TranscriptForLead[] (no content column)
}
```

### Placement

In `lead-sheet-right-column.tsx`, add `<LeadTranscriptsSection>` after the Meetings section:

```
Right Column:
  Quick Actions
  AI Suggestions
  Tasks
  Meetings
  Transcripts   <-- NEW (replaces the removed LeadTranscriptSuggestionsSection)
  Proposals
```

This naturally fills the gap left by removing `LeadTranscriptSuggestionsSection` (Phase 3).

## Project Detail Page

**Note:** Emails are not currently surfaced on project detail pages either. Adding transcript surfacing to projects is deferred — it requires establishing the pattern for both emails and transcripts on projects, which is a larger scope.

For v1, transcripts are surfaced via the client page (which covers CLIENT-type projects) and the lead sheet (which covers lead-related meetings). Internal project transcripts are accessible via the inbox Transcripts tab filtered by project.

## Query Layer

**File:** `lib/queries/transcripts.ts` (created in Phase 5 — shared by triage UI and context surfacing)

The core query functions are defined in Phase 5's scope since the triage UI needs `listTranscripts()`, `getTranscriptCounts()`, and `getTranscriptById()`. Phase 5b adds the entity-specific surfacing queries:

```typescript
// --- Created in Phase 5 (triage UI needs these) ---

// List transcripts by classification (for inbox views)
export async function listTranscripts(options: {
  classification?: string
  clientId?: string
  projectId?: string
  leadId?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<TranscriptSummary[]>

// Get counts by classification (for tab badges)
export async function getTranscriptCounts(): Promise<{
  unclassified: number
  classified: number
  dismissed: number
}>

// Get single transcript with content (for detail view)
export async function getTranscriptById(id: string): Promise<TranscriptDetail | null>

// Update transcript (classification, AI cache, etc.)
export async function updateTranscript(id: string, data: Partial<TranscriptUpdate>): Promise<void>

// --- Added in Phase 5b (entity surfacing) ---

// Get transcripts for entity surfacing (NO content column)
export async function getTranscriptsForClient(clientId: string, options?: { limit?: number }): Promise<TranscriptForClient[]>
export async function getTranscriptsForLead(leadId: string, options?: { limit?: number }): Promise<TranscriptForLead[]>
```

**Critical pattern:** All list/summary queries exclude the `content` column. Only `getTranscriptById()` fetches content. This prevents multi-megabyte payloads on list views (50 transcripts x 100KB = 5MB).

## Implementation Checklist (Phase 5b)

1. Create `lib/queries/transcripts.ts` with all query functions
   - Ensure `content` is excluded from list queries
   - Include `getTranscriptsForClient()` and `getTranscriptsForLead()`
2. Create `client-transcripts-section.tsx` (mirrors `client-emails-section.tsx`)
3. Add to `client-detail.tsx` right column
4. Create `lead-transcripts-section.tsx` (mirrors `lead-email-threads.tsx`)
5. Create `GET /api/leads/[leadId]/transcripts` route
6. Add to `lead-sheet-right-column.tsx` (in the slot freed by Phase 3 cleanup)
7. Test: classify transcript to client -> appears on client detail page
8. Test: classify transcript to lead -> appears on lead sheet
9. Test: dismiss/unclassify -> removed from entity pages
