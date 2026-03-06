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

## Tab Changes

**File:** `app/(dashboard)/my/inbox/_components/inbox-tabs.tsx`

```typescript
type InboxNavTab = 'triage' | 'emails' | 'transcripts'

const INBOX_TABS: Array<{ label: string; value: InboxNavTab; href: string }> = [
  { label: 'Triage', value: 'triage', href: '/my/inbox/triage' },
  { label: 'Emails', value: 'emails', href: '/my/inbox/emails' },
  { label: 'Transcripts', value: 'transcripts', href: '/my/inbox/transcripts' },
]
```

Update `activeTab` derivation to detect `/my/inbox/transcripts` path.

**File:** `app/(dashboard)/my/inbox/_components/inbox-tabs-row.tsx`

- Pass `unclassifiedTranscriptCount` as a prop
- Show badge on Transcripts tab when count > 0
- Contextual sync button: show "Sync Emails" on email tab, "Sync Transcripts" on transcripts tab

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
- **Classification actions**: Classify button (opens classification panel), Dismiss button
- **Expandable content**: click to show full transcript in a detail panel

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

## Sync Controls

When the user is on the Transcripts tab:
- Show "Sync Transcripts" button (instead of "Sync Emails")
- Display last transcript sync time
- Auto-sync on mount + every 60 seconds (same pattern as email sync)
- Calls `POST /api/integrations/transcripts/sync`

When the user manually syncs, show a toast: "Sync complete — {N} new transcripts found"

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

1. Modify `inbox-tabs.tsx` — add Transcripts tab
2. Modify `inbox-tabs-row.tsx` — contextual sync button, transcript count badge
3. Modify `inbox/layout.tsx` — fetch transcript counts
4. Create `app/(dashboard)/my/inbox/transcripts/[[...view]]/page.tsx`
5. Create `transcript-list-view.tsx`
6. Create `transcript-row.tsx`
7. Create `transcript-detail-panel.tsx`
8. Create `transcript-classification-panel.tsx`
9. Create `transcript-sidebar.tsx`
10. Create `GET /api/transcripts` route
11. Create `PATCH /api/transcripts/[transcriptId]` route
12. Create `POST /api/transcripts/batch` route
13. Wire sync controls for transcript tab
14. Test: navigate to Transcripts tab, view unclassified list
15. Test: classify a transcript as client → verify status change
16. Test: classify as lead → verify client/project cleared
17. Test: dismiss → verify links cleared
18. Test: batch dismiss → verify multiple transcripts dismissed
