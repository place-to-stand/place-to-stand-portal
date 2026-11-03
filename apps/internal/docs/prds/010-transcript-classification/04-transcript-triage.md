# 04: Transcript Triage UI

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **5 — Inbox UI**
> Dependencies: [02-data-model.md](./02-data-model.md), [03-drive-sync.md](./03-drive-sync.md), [05-ai-classification.md](./05-ai-classification.md)

## Entry Point

Transcripts get a **top-level tab** in the inbox, alongside Triage and Emails:

```
/my/inbox/
├── triage/          ← existing: email triage queue
├── emails/          ← existing: email list views
├── transcripts/     ← NEW: transcript list views
```

- Tab order: **Triage** | **Emails** | **Transcripts**
- Badge on Transcripts tab shows unclassified count
- Transcripts tab shows all transcripts (global, not per-user)
- **Transcripts tab is hidden for non-admin users** — only rendered in nav when `isAdmin(user)` is true

## Tab Changes

**File:** `app/(dashboard)/my/inbox/_components/inbox-tabs.tsx`

```typescript
type InboxNavTab = 'triage' | 'emails' | 'transcripts'

const INBOX_TABS: Array<{
  label: string
  value: InboxNavTab
  href: string
  adminOnly?: boolean
}> = [
  { label: 'Triage', value: 'triage', href: '/my/inbox/triage' },
  { label: 'Emails', value: 'emails', href: '/my/inbox/emails' },
  {
    label: 'Transcripts',
    value: 'transcripts',
    href: '/my/inbox/transcripts',
    adminOnly: true,
  },
]
```

Update `activeTab` derivation to detect `/my/inbox/transcripts` path. Filter tabs by `adminOnly` based on current user role — non-admins never see the Transcripts tab.

**File:** `app/(dashboard)/my/inbox/_components/inbox-tabs-row.tsx`

- Pass `unclassifiedTranscriptCount` and `isAdmin` as props
- Show badge on Transcripts tab when count > 0
- Contextual sync: Triage tab syncs both, Emails tab syncs emails, Transcripts tab syncs transcripts

**File:** `app/(dashboard)/my/inbox/layout.tsx`

- Fetch transcript counts alongside thread counts using `getTranscriptCounts()`
- Pass to `InboxTabsRow`

## Transcripts List Page

**New file:** `app/(dashboard)/my/inbox/transcripts/[[...view]]/page.tsx`

Server component:

```typescript
export default async function TranscriptsPage({ params }: { params: Promise<{ view?: string[] }> }) {
  const user = await requireUser()
  assertAdmin(user)

  const { view } = await params
  const currentView = view?.[0] ?? 'unclassified'  // Default to unclassified

  const [transcripts, counts, clients, projects, leads] = await Promise.all([
    listTranscripts({ classification: currentView, limit: 50, offset: 0 }),
    getTranscriptCounts(),
    // Fetch clients, projects, leads for classification dropdowns
    fetchActiveClients(),
    fetchActiveProjects(),
    fetchActiveLeads(),
  ])

  return (
    <TranscriptListView
      transcripts={transcripts}
      counts={counts}
      currentView={currentView}
      clients={clients}
      projects={projects}
      leads={leads}
    />
  )
}
```

Views follow the same URL pattern as emails:

- `/my/inbox/transcripts` → unclassified (default)
- `/my/inbox/transcripts/classified` → classified
- `/my/inbox/transcripts/dismissed` → dismissed

## Transcript List View

**New file:** `app/(dashboard)/my/inbox/_components/transcript-list-view.tsx`

Layout:

```
┌─────────────────────────────────────────────────────────┐
│  [Unclassified (12)] [Classified (45)] [Dismissed (8)]  │  ← Sub-tabs
│  [Search transcripts...]                [Batch Dismiss]  │  ← Search + actions
├─────────────────────────────────────────────────────────┤
│  📄 Weekly Sync - Client Team             Mar 5, 2026   │  ← Transcript row
│     Participants: Jason, Sarah, Mike                     │
│     🤖 AI: Acme Corp → Website Redesign (85%)          │  ← Cached AI suggestion
│     [Classify ▾]                          [Dismiss]      │
├─────────────────────────────────────────────────────────┤
│  📄 Discovery Call - New Lead             Mar 4, 2026   │
│     Participants: Jason, Jane Doe                        │
│     🤖 AI: Lead → Jane Doe / Startup Co (72%)          │
│     [Classify ▾]                          [Dismiss]      │
├─────────────────────────────────────────────────────────┤
│                    Load more...                          │
└─────────────────────────────────────────────────────────┘
```

## Transcript Row

**New file:** `app/(dashboard)/my/inbox/_components/transcript-row.tsx`

Each row displays:

- **Title** (from document title)
- **Meeting date** (formatted, or "Date unknown" if not extracted)
- **Participants** (truncated list of speaker names)
- **AI suggestion badge** (if analyzed): "AI: {ClientName} → {ProjectName} ({confidence}%)" or "AI: Lead → {LeadName} ({confidence}%)"
  - Most transcripts arrive pre-analyzed (auto-analyze on sync). The "Analyze" button only appears if auto-analysis failed or was skipped.
- **Classification actions**: Classify button (opens classification panel), Dismiss button
- **Expandable content**: click to show full transcript in a detail panel

> **Performance note:** Transcript rows are rendered from list query data which excludes the `content` column. Content is only fetched when the user expands the detail panel.

For classified transcripts, show the classification badge instead of actions:

- "Client: Acme Corp → Website Redesign" with an "Edit" button to reclassify

## Transcript Detail Panel

**New file:** `app/(dashboard)/my/inbox/_components/transcript-detail-panel.tsx`

Expandable panel (or slide-out sheet) showing:

- Full transcript text in a scrollable pre-formatted view
- Meeting metadata: date, duration, participants
- Link to original Google Doc (driveFileUrl)
- Classification panel (inline or sidebar)

## Transcript Classification Panel

**New file:** `app/(dashboard)/my/inbox/_components/transcript-classification-panel.tsx`

Reuse the pattern from `thread-classification-panel.tsx`:

Three tracks:

1. **Client Track** — select client, optionally select project
2. **Internal Track** — select internal/personal project
3. **Lead Track** — select lead

Pre-populated with cached AI suggestions (if analyzed). User confirms or changes.

On submit: `PATCH /api/transcripts/{transcriptId}` with classification data.

**Mutual exclusivity enforced in UI**: selecting lead track disables client/project fields and vice versa.

## Eager AI Analysis on Page Load

Since AI classification results are cached in the transcript record (see [05-ai-classification.md](./05-ai-classification.md)), the triage page should **eagerly trigger analysis** for unanalyzed transcripts on load. This ensures suggestions are ready by the time the user reaches each item.

When the transcript list loads (any view), fire `POST /api/transcripts/{id}/analyze` for any visible transcripts where `aiAnalyzedAt` is NULL. These calls are non-blocking — the UI renders immediately and updates suggestion badges as results arrive. The endpoint returns cached results instantly for already-analyzed transcripts (no wasted calls).

**Implementation:** On the client, use a `useEffect` (or React Query mutation) that iterates visible unanalyzed transcripts and fires analyze calls in parallel (batch of 5 at a time to avoid flooding). On completion, invalidate the transcript list query to refresh suggestion badges.

This same pattern applies to the **email triage page** — when loading the triage queue, eagerly trigger `POST /api/threads/{id}/suggestions` for any threads without cached AI results. Since both endpoints cache results, repeated loads are free.

## Triage Row Checkbox Hit Area

**File:** `app/(dashboard)/my/inbox/_components/triage-row.tsx`

The existing checkbox click target in triage rows is too small (just the 16x16 checkbox icon). Increase the hit area by adding padding to the checkbox wrapper:

```typescript
// BEFORE:
<div className='flex flex-shrink-0 pt-0.5' onClick={...}>
  <Checkbox ... className='h-4 w-4' />
</div>

// AFTER:
<div className='-m-2 flex flex-shrink-0 p-2' onClick={...}>
  <Checkbox ... className='h-4 w-4' />
</div>
```

Use negative margin + padding to expand the clickable area without affecting layout. Apply to both `triage-row.tsx` and `thread-row.tsx` (email list rows have the same issue). Also apply to the new `transcript-row.tsx`.

## Sync Controls

**Triage tab** — sync button triggers **both** email sync and transcript sync. Email sync fires first; transcript sync fires in parallel as **fire-and-forget** (don't block the UI waiting for Drive API). Auto-sync interval: email every 60s, transcript every 5 minutes (Drive changes less frequently, and transcript sync is heavier due to Docs API content fetches). This prevents the triage tab from feeling sluggish.

**Emails tab** — sync button triggers email sync only. Display last email sync time. Auto-sync every 60s.

**Transcripts tab** — sync button triggers transcript sync only. Display last transcript sync time. Calls `POST /api/integrations/transcripts/sync`. Auto-sync every 60s (user is actively on this tab, faster refresh is expected).

When the user manually syncs, show a toast with results:

- Triage: "Sync complete — {N} new emails, {M} new transcripts"
- Emails: "Sync complete — emails synced successfully"
- Transcripts: "Sync complete — {N} new transcripts found"

## API Endpoints

### List Transcripts

`GET /api/transcripts`

Query params: `classification`, `clientId`, `projectId`, `leadId`, `search`, `limit`, `offset`

Returns paginated transcript list with counts.

### Classify Transcript

`PATCH /api/transcripts/{transcriptId}`

Body: `{ classification, clientId?, projectId?, leadId? }`

Enforces mutual exclusivity and behavioral invariants.

### Batch Dismiss

`POST /api/transcripts/batch`

Body: `{ ids: string[], action: 'dismiss' }`

Dismiss multiple transcripts at once.

### Bulk Dismiss by Date

`POST /api/transcripts/batch`

Body: `{ action: 'dismiss_before', before: '2026-01-01T00:00:00Z' }`

Dismiss all unclassified transcripts where `meetingDate` (or `createdAt` if `meetingDate` is NULL) is before the given timestamp. This is useful for initial onboarding — when sync discovers hundreds of historical transcripts, users can clear the backlog in one action: "dismiss everything before January 2026."

SQL: `WHERE classification = 'UNCLASSIFIED' AND COALESCE(meeting_date, created_at) < {before}`

The UI shows a "Dismiss older than..." dropdown with options: 1 week, 1 month, 3 months, 6 months, 1 year.

## Sidebar Navigation

**New file:** `app/(dashboard)/my/inbox/_components/transcript-sidebar.tsx`

Sidebar for transcript views (mirrors the email sidebar pattern):

```
Transcripts
  Unclassified  (12)
  Classified    (45)
  Dismissed      (8)
```

## Implementation Checklist (Phase 5)

1. Modify `inbox-tabs.tsx` — add Transcripts tab (hidden for non-admins via `adminOnly` + `isAdmin` prop)
2. Modify `inbox-tabs-row.tsx` — contextual sync button, transcript count badge, fire-and-forget transcript sync from triage tab
3. Modify `inbox/layout.tsx` — fetch transcript counts
4. Create `app/(dashboard)/my/inbox/transcripts/[[...view]]/page.tsx`
5. Create `transcript-list-view.tsx`
6. Create `transcript-row.tsx` (content excluded from list data, lazy-load on expand)
7. Create `transcript-detail-panel.tsx`
8. Create `transcript-classification-panel.tsx`
9. Create `transcript-sidebar.tsx`
10. Create `GET /api/transcripts` route (exclude `content` column from list response)
11. Create `PATCH /api/transcripts/[transcriptId]` route
12. Create `POST /api/transcripts/batch` route (support both `dismiss` and `dismiss_before` actions)
13. Wire sync controls: triage syncs both (transcript fire-and-forget, 5min interval), emails tab syncs emails, transcripts tab syncs transcripts
14. Add "Dismiss older than..." dropdown UI for bulk backlog clearing
15. Wire eager AI analysis on transcript list load (batch of 5, non-blocking, update badges on completion)
16. Wire eager AI analysis on email triage page load (same pattern — fire suggestions for unanalyzed threads)
17. Increase checkbox hit area on `triage-row.tsx`, `thread-row.tsx`, and `transcript-row.tsx` (negative margin + padding pattern)
18. Test: navigate to Transcripts tab, view unclassified list
19. Test: classify a transcript as client → verify status change
20. Test: classify as lead → verify client/project cleared
21. Test: dismiss → verify links cleared
22. Test: batch dismiss → verify multiple transcripts dismissed
23. Test: bulk dismiss by date → verify older transcripts cleared
24. Test: non-admin user does not see Transcripts tab
