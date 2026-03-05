# 04: Triage Mode

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **3 — Triage Mode UI**
> Dependencies: [02-data-model.md](./02-data-model.md) (classification column must exist)

## Concept

A dedicated view for rapidly classifying unclassified threads. Process one thread at a time: review the auto-detected match, accept/modify/dismiss, auto-advance to the next.

The key UX insight: **the system already has matching logic** (contact → client, email → lead) from `lib/email/matcher.ts` and the AI matching in `lib/ai/email-client-matching.ts` / `lib/ai/email-project-matching.ts`. Triage mode surfaces these matches as **pre-filled suggestions that the user confirms or overrides**, rather than asking the user to do the matching from scratch.

## Entry Point

Triage is a **top-level tab** in the inbox, not nested under Emails:

```
/my/inbox/
├── triage/          ← NEW: first tab, source-agnostic
├── emails/          ← existing email views
├── (future: meetings/, messages/, etc.)
```

- URL: `/my/inbox/triage`
- Tab order: **Triage** | Emails | (future sources)
- Badge on the Triage tab shows unclassified count across ALL sources
- Triage tab is positioned first (leftmost) because classification is the primary workflow

**Routing architecture**: This requires a shared layout at `app/(dashboard)/my/inbox/layout.tsx` that renders the top-level tab bar. The existing `app/(dashboard)/my/inbox/page.tsx` redirect is replaced by a layout that wraps both the triage and emails routes. The triage page lives at `app/(dashboard)/my/inbox/triage/page.tsx`.

## Triage Card Layout

Each card shows a single thread with its auto-detected classification suggestion.

**Match found (client contact recognized):**
```
┌──────────────────────────────────────────────────┐
│  ✉ Subject: Re: Website redesign proposal        │
│  From: jane@acme.co • 3 participants • 2h ago    │
│                                                  │
│  ┌─ Detected: Client Work ─────────────────────┐ │
│  │ Client:  [Acme Corp          ▼]  ✓ matched  │ │
│  │ Project: [Website Redesign   ▼]              │ │
│  │                                              │ │
│  │ ↻ Switch to Lead                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  "Hey Jason, following up on our call about      │
│   the redesign timeline. Can we push the..."     │
│                                                  │
│  [✓ Accept]        [× Dismiss]        [→ Skip]   │
│                                                  │
│  Classified 8 this session ━━━━━━━━━━━━━━━━━━━━  │
└──────────────────────────────────────────────────┘
```

**No match found (unknown sender):**
```
┌──────────────────────────────────────────────────┐
│  ✉ Subject: Quick question about your services   │
│  From: hello@newcompany.io • 1 participant • 5h  │
│                                                  │
│  ┌─ No match found ────────────────────────────┐ │
│  │                                              │ │
│  │ [Link to Client]    [Link to Lead]           │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  "Hi, we're looking for an agency to help us     │
│   with a rebrand. Would love to chat about..."   │
│                                                  │
│  [✓ Accept]        [× Dismiss]        [→ Skip]   │
│                                                  │
│  Classified 8 this session ━━━━━━━━━━━━━━━━━━━━  │
└──────────────────────────────────────────────────┘
```

**No match → after clicking "Link to Client":**
```
┌──────────────────────────────────────────────────┐
│  ✉ Subject: Quick question about your services   │
│  From: hello@newcompany.io • 1 participant • 5h  │
│                                                  │
│  ┌─ Client Work ───────────────────────────────┐ │
│  │ Client:  [Select client...       ▼]         │ │
│  │ Project: [Select project...      ▼]         │ │
│  │                                              │ │
│  │ ↻ Switch to Lead                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  "Hi, we're looking for an agency to help us     │
│   with a rebrand. Would love to chat about..."   │
│                                                  │
│  [✓ Accept]        [× Dismiss]        [→ Skip]   │
│                                                  │
│  Classified 8 this session ━━━━━━━━━━━━━━━━━━━━  │
└──────────────────────────────────────────────────┘
```

**Sections:**

**Header:**
- Subject line
- Sender name/email, participant count, relative timestamp
- Source indicator (email icon; future: meeting/chat icons)

**Detection Panel (the core interaction):**
- System pre-selects a **track** based on existing matching logic:
  - **Client Work** — if the sender's email/domain matches a known client contact. Pre-fills client dropdown (and project if AI match found).
  - **Lead** — if the sender matches an existing lead. Pre-fills lead dropdown.
  - **No match** — no track pre-selected. Shows "Link to Client" and "Link to Lead" buttons. Clicking either button **expands inline** into the corresponding track's dropdowns (empty, user must select). Dismiss is the most prominent action here since the majority of unknown-sender emails are noise.
- User can:
  - Accept the suggestion as-is (one click/keystroke)
  - Change the dropdown selections (pick a different client/project/lead)
  - Switch tracks entirely ("Switch to Lead" / "Switch to Client Work")

**Body:**
- Snippet / first few lines of the latest message
- Expandable to show full thread without leaving triage mode

## Detection Logic & Matcher Refactor

The detection panel uses existing matching infrastructure, but **matchers must be refactored to be read-only** (they currently write links as side effects).

**Current problem**: `matchAndLinkThread()` in `lib/email/matcher.ts` writes the `clientId` directly to the `threads` table. `linkThreadToLead()` writes `leadId`. These cannot be used as suggestion engines.

**Required refactor**: Split each matcher into two functions:
- `suggestClientMatch(participantEmails[])` → returns `{ clientId, clientName, confidence }` without writing (pure read)
- `suggestLeadMatch(participantEmails[])` → returns `{ leadId, leadName, contactEmail }` without writing (pure read)

The write operations (`applyClientMatch`, `applyLeadMatch`) are handled by the existing `PATCH /api/threads/[threadId]` endpoint on accept.

The AI matchers (`email-client-matching.ts`, `email-project-matching.ts`) already return candidates without writing, so they need no changes.

**Detection flow per triage card:**

1. **Check client contacts** (via new `suggestClientMatch`):
   - Exact email match → HIGH confidence, pre-fill client, select Client Work track
   - Domain match → MEDIUM confidence, pre-fill client, select Client Work track
   - If client found, run `matchEmailToProjects()` to suggest a project

2. **Check leads** (via new `suggestLeadMatch`):
   - Exact email match on `leads.contactEmail` → pre-fill lead, select Lead track

3. **No match found**:
   - No track pre-selected
   - Show "Link to Client" and "Link to Lead" buttons
   - Dismiss is visually prominent since most unknown-sender emails are noise

4. **Conflict resolution** (client AND lead match):
   - Client match takes priority (existing relationship > potential lead)
   - "Switch to Lead" link available to override

## Triage API Endpoint

A new endpoint powers the triage view:

**`GET /api/triage`**

Returns a paginated list of unclassified threads with pre-computed match suggestions:

```typescript
// Response shape
{
  threads: Array<{
    thread: ThreadSummary
    suggestion: {
      track: 'client_work' | 'lead' | null
      client?: { id: string, name: string, confidence: 'HIGH' | 'MEDIUM' }
      lead?: { id: string, name: string }
    }
  }>
  total: number
}
```

**Implementation**: The endpoint runs the deterministic matchers (`suggestClientMatch`, `suggestLeadMatch`) for each thread in the page. AI project matching is deferred to a separate on-demand call when the user focuses a specific card (not included in this response shape — fetched client-side when needed). Pagination keeps the initial load fast (e.g., 10 threads per page with suggestions pre-computed).

**Access control**: This endpoint requires an authenticated user via `requireUser()`. All users with inbox access can use the triage view — no additional role check is needed since the unclassified threads query already scopes to the user's connected email accounts.

**Session count** (`classified_this_session`) is tracked client-side via React state — it resets when the user navigates away from triage and back.

## Accept Requirements

The **Accept** button is disabled until a valid selection is made:

| Track | Required Selection | Optional |
|-------|-------------------|----------|
| Client Work | Client must be selected | Project (can be empty) |
| Lead | Lead must be selected (existing or new) | — |
| No track | Must select a track and make a selection first | — |

This ensures every accepted thread is fully linked. No partial classifications.

On accept:
1. Link the thread to the selected client/project/lead (via existing `PATCH /api/threads/[threadId]`)
2. Classification auto-sets to `CLASSIFIED` via [02-data-model.md §Auto-Classify on Link](./02-data-model.md#auto-classify-on-link)
3. If lead track: update `leads.lastContactAt` with thread's `lastMessageAt`
4. Auto-advance to next thread

## Dismiss Flow

Dismiss sets `classification = 'DISMISSED'`, `classified_by`, `classified_at` and advances. Any existing links are removed per [02-data-model.md §Dismiss Unlinks](./02-data-model.md#dismiss-unlinks).

No confirmation dialog — dismissed threads are recoverable from the "Dismissed" view (see [05-inbox-views.md](./05-inbox-views.md)). Keep triage fast.

## Triage Actions & Keyboard Shortcuts

**v1 shortcuts** — keep it minimal. Additional shortcuts can be added based on usage feedback.

| Action | Keyboard Shortcut | Behavior |
|--------|-------------------|----------|
| Accept | `Enter` | Accept current detection (disabled until valid selection) |
| Dismiss | `d` | Sets classification to `DISMISSED`, advances |
| Skip | `→` | Moves to next without classifying |
| Go Back | `←` | Returns to previous thread |
| Expand Thread | `Space` | Toggle full message thread view |

> **Deferred shortcuts**: Track switching (`t`), dropdown focus (`c`, `p`), open detail (`o`). Add these if users request them after using v1.

## Queue Ordering

**v1: Simple recency ordering.** Sort by `lastMessageAt` descending (most recent first).

> **Why not smart ordering?** Pre-computing match confidence for all unclassified threads requires running matchers against every thread upfront — expensive for large backlogs and complex to maintain. Recency is a good proxy: recent threads are most relevant and most likely to have active client/lead matches. Smart ordering (confidence tiers) is a future enhancement once we have match suggestions cached.

## Progress Indicator

- Persistent indicator at the bottom of the triage card
- Format: **"Classified 8 this session"** — counts only the current triage session (client-side state, resets on navigation)
- When the queue is empty: "All caught up" state
- The Triage tab badge shows the total unclassified count (always visible)

> **Why session count instead of total progress?** A total progress bar ("23 of 147 · 16%") feels punitive for a small team with a large backlog. Session count is encouraging — "I got through 12 today" — without implying you should process all 147.

## Implementation Checklist (Phase 3)

1. Refactor matchers: create `suggestClientMatch` and `suggestLeadMatch` (read-only functions in `lib/email/matcher.ts`)
2. Build `GET /api/triage` endpoint (paginated unclassified threads with match suggestions)
3. Create `app/(dashboard)/my/inbox/layout.tsx` with top-level tab bar (Triage | Emails)
4. Create `/my/inbox/triage/page.tsx` route
5. Build triage card component with detection panel (match found, no match, inline expand states)
6. Implement accept/dismiss/skip flow with auto-advance
7. Keyboard shortcuts (Enter, d, arrows, Space)
8. Session progress indicator and Triage tab badge
