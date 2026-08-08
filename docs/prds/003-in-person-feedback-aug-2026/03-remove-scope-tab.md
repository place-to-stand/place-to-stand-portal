# 03 — Remove the Scope Tab and SOW Functionality

**Depends on:** Nothing (parallelizable with 01/02/04/05)
**App:** `apps/internal/` + `packages/db/`
**Decisions:** D6, D7, D8 (see [README.md](README.md))
**Review codes:** W7, I1 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

Ask: "Remove scopes tab and functionality entirely." The Scope tab links Google Docs SOWs to
projects, snapshots their content, and tracks per-SOW status. It's unused and being retired.

The footprint was fully inventoried (2026-08-07). Key findings that make this a clean removal:
**no inbound FKs** into the three SOW tables from anywhere; **no activity events** were ever logged
for SOWs; **no client-portal, planning, task, or invoice coupling**; the entire
`apps/internal/lib/google/` layer (Docs/Drive/Picker) has **zero non-SOW consumers**.

## Fix

Delete the feature end to end: route, tab registration, components, queries, server actions, the
Google Docs integration layer, the picker API route and types, then drop the three tables and two
enums in a migration (D6 — data drops too; source documents remain in Google Docs). The old
`/scope` URL redirects to `/tasks` (D7).

## Implementation

### 1. Files to DELETE outright

| Path | What it is |
|------|-----------|
| `apps/internal/app/(dashboard)/projects/_components/scope/` (whole dir: `scope-tab-content.tsx`, `sow-card.tsx`, `sow-document-renderer.tsx`, `sow-section-list.tsx`, `sow-sync-button.tsx`, `sow-picker-button.tsx`, `use-google-picker.ts`) | Scope tab UI |
| `apps/internal/components/scope/sow-status-cell.tsx` (leaves `components/scope/` empty — remove the dir) | Status cell (SOW-only, not shared) |
| `apps/internal/lib/scope/sow-status.ts` (remove the `lib/scope/` dir) | Status enums/labels/tokens |
| `apps/internal/app/(dashboard)/projects/actions/sow.ts` | Server actions (`linkSow`, `syncSow`, `updateSowStatus`, …) |
| `apps/internal/lib/queries/sow.ts` | All 14 SOW query functions (I1) |
| `apps/internal/lib/google/` (whole dir: `docs.ts`, `sow-parser.ts`, `sow-parser-types.ts`, `sow-snapshot.ts`) | Google Docs integration — zero non-SOW consumers (D8). Its dep on `lib/gmail/client.ts` (`getValidAccessToken`) is outbound-only; **keep** `lib/gmail/` |
| `apps/internal/app/api/google/picker-token/route.ts` (leaves `app/api/google/` empty — remove the dir; do **NOT** touch `app/api/auth/google/`, `app/api/auth/callback/google/`, or `app/api/integrations/google/*`) | Picker token endpoint, sole caller was `use-google-picker.ts` |
| `apps/internal/types/google-picker.d.ts` | `google.picker` ambient types, only used by the picker hook. **(I1)** It's the *only* file in `apps/internal/types/` — remove the dir too (tsconfig uses a blanket `**/*.ts` include; safe). **(I1)** `sow-parser-types.ts` contains no literal "sow" string — delete it **by path**, the final grep sweep will not catch a leftover. |

### 2. Files to EDIT (surgical removals)

**Tab registration** (all under `apps/internal/app/(dashboard)/projects/`):

- `_components/projects-board/projects-board-tabs-header.tsx` — remove `'scope'` from the
  `initialTab` union (~L20), `scopeHref` (~L26) / `scopeDisabled` (~L30) props + destructuring
  (~L48, 52), and the whole `<TabsTrigger value='scope'>…</TabsTrigger>` block (~L71–95, which also
  drops its `startBoardTabInteraction(initialTab, 'scope')` call — no change needed in
  `board-tab-interaction.ts` itself; it takes plain strings).
- `_components/projects-board/projects-board-tabs.tsx` — remove the `ScopeTabContent` import
  (~L20), `'scope'` union member (~L38), and the `<ScopeTabContent …/>` render (~L223–226).
  **(W7) The scope props are NON-CONTIGUOUS — delete named lines only, never the range:** props
  `scopeHref` L44, `scopeDisabled` L48, `scopeProjectId` L49 (L45–47 are
  `activityDisabled`/`reviewDisabled`/`timeLogsDisabled` — keep); destructuring `scopeHref` L101,
  `scopeDisabled` L105, `scopeProjectId` L106 (L102–104 are the other tabs' — keep); header
  pass-throughs `scopeHref` L159, `scopeDisabled` L163 (L160–162 are the other tabs' — keep).
- `_components/projects-board/projects-board-tabs-section.tsx` — remove `'scopeHref'` (~L13) /
  `'scopeDisabled'` (~L17) from `NavigationProps`, the `ScopeProps` type (~L73–76), `scope:
  ScopeProps` (~L86), destructured `scope` (~L102), `{...scope}` spread (~L115).
- `_hooks/use-projects-board-navigation.ts` — remove `scopeHref` (~L14) / `scopeDisabled` (~L18)
  from `ProjectsBoardNavigation`. **(W7) The computation block is also non-contiguous:** delete
  `scopeHref` **L58–60** and `scopeDisabled` **L64** only — **L61–63 are
  `activityDisabled`/`reviewDisabled`/`timeLogsDisabled` and must stay.**
- `_hooks/use-projects-board-view-model.ts` — remove `'scope'` from the `initialTab` union (~L35);
  the `scope: { scopeProjectId: … }` block (~L184–186); and **carefully** edit ~L73:
  ```ts
  // BEFORE — compound conditional; delete ONLY the scope clause:
  const currentBoardView = initialTab === 'timeLogs' || initialTab === 'overview' || initialTab === 'scope' ? 'board' : initialTab
  // AFTER:
  const currentBoardView = initialTab === 'timeLogs' || initialTab === 'overview' ? 'board' : initialTab
  ```
  A careless delete here breaks the `timeLogs`/`overview` → `'board'` fallback every other tab
  depends on.
- `_hooks/builders/build-projects-board-tabs.ts` — remove `scope` from `BuildTabsArgs` (~L12), the
  destructure (~L23), and the return object (~L33).

**Route → redirect (D7)** — replace the body of
`apps/internal/app/(dashboard)/projects/[clientSlug]/[projectSlug]/scope/page.tsx` with a redirect,
matching the sibling tab pages' named-`PageProps` convention (I1; deliberately dropping the
`metadata` export — a redirect page renders nothing):

```ts
import { redirect } from 'next/navigation'

type PageProps = { params: Promise<{ clientSlug: string; projectSlug: string }> }

export default async function ProjectScopeRoute({ params }: PageProps) {
  const { clientSlug, projectSlug } = await params
  redirect(`/projects/${clientSlug}/${projectSlug}/tasks`)
}
```

**OAuth (D8)** — `apps/internal/lib/oauth/google.ts`: delete the `GOOGLE_DOCS_SCOPES` const
(L40–43, doc comment L39) and `hasDocsScopes()` (L73–78 incl. JSDoc) — both already dead (zero
callers). **Leave `GOOGLE_SCOPES` untouched**, including its Drive/Docs entries (L20–21) — it's
consumed by the OAuth connect flow (`app/api/auth/google/route.ts`, callback) and narrowing it is a
live-behavior change, deferred to [06-future-scope.md](06-future-scope.md).

**Docs** — `CLAUDE.md`: tab list (~L109) drops `scope`; delete the `project_sows` +
`sow_snapshots` + `sow_sections` schema bullet (~L145).

**Verified during review (I1) — no action needed, listed so nobody re-litigates:**
- `apps/internal/lib/db/schema.ts` is a one-line `export * from '@pts/db/schema'` — **no SOW blocks
  to remove there**; the `packages/db` edits flow through automatically.
- No picker-specific env vars exist anywhere (the picker route reads only the shared
  `GOOGLE_CLIENT_ID` — keep it). `env.server.ts`, `.env.example`, `turbo.json` all clean.
- No Google npm deps to remove — `lib/google/` uses raw `fetch` and the CDN-loaded `google.picker`
  global.

**Final sweep:** `grep -ri "sow\|ScopeTab\|scopeHref\|google-picker\|picker-token" apps/ packages/`
→ expected remaining hits: historical migrations/snapshots, this PRD's docs, and false positives
(`previousOwnerId` in `save-project.ts` matches "sOw"; OAuth "scopes"; prose "client-scoped"). Keep
the precise strings — do not loosen `picker-token` to `picker` (~25 unrelated picker components).

### 3. Schema + migration (D6)

`packages/db/src/schema.ts` — delete lines ~1302–1423 inclusive: the SOW banner comment, the
`sowSnapshotStatus` + `sowStatus` pgEnums, and the `projectSows` / `sowSnapshots` / `sowSections`
tables. (The AI-planning banner at ~1425 stays.)

`packages/db/src/relations.ts`:
- Remove `projectSows, sowSnapshots, sowSections` from the schema import (~L36–38)
- Remove `sows: many(projectSows)` inside `projectsRelations` (~L260 — single line; keep the block)
- Delete the SOW relations banner + three relation blocks (~L539–583; `formSubmissionsRelations`
  at ~585 stays)
- `usersRelations` has no SOW back-reference — no edit

Generate from `packages/db/`:

```bash
npm run db:generate -- --name remove_sow_tables
```

The output will be `0058_remove_sow_tables.sql` (journal currently ends at `0057_monthly_close_snapshots`).
Review the generated SQL: expect `DROP TABLE` for `sow_sections`, `sow_snapshots`, `project_sows`
(children first — all inter-SOW FKs are CASCADE and internal) and `DROP TYPE` for
`sow_snapshot_status`, `sow_status`. Both enums are used **only** by these tables (verified).
Precedent: `packages/db/drizzle/migrations/0051_remove_comms_proposals_meetings_scoring.sql`. Do
**not** edit historical migrations or `meta/*_snapshot.json` by hand. The stale
`apps/internal/drizzle/migrations/` dir (stops at 0045, pre-SOW) needs no change. Apply with
`npm run db:migrate` locally, then staging/production.

> **Data loss is intentional and irreversible (D6):** `sow_snapshots.raw_content` /
> `text_content` hold the portal's only copies of historical doc versions. Decision: drop —
> the live documents remain in Google Docs. This is the deliberate exception to the soft-delete
> convention because the feature itself is being removed.

## Acceptance criteria

- [ ] Scope tab gone from the project workspace tab bar; tab order otherwise unchanged (overview → tasks/board …)
- [ ] `/projects/{clientSlug}/{projectSlug}/scope` redirects to `.../tasks` (no 404)
- [ ] All files in §1 deleted; `grep -ri "ScopeTabContent\|sow-status\|picker-token\|use-google-picker"` returns nothing
- [ ] Board tab switching (overview, tasks, review, time-logs, activity, archive) works; deep links to each tab work; PostHog `BOARD_TAB_SWITCH` still fires for remaining tabs
- [ ] Google OAuth connect/reconnect flow (Gmail/Calendar) unaffected; `app/api/auth/google/*` and `app/api/integrations/google/*` untouched
- [ ] Migration generated, reviewed (drop order: sections → snapshots → sows → types), applied locally; `npm run db:migrate` idempotent
- [ ] `packages/db` relations compile; no orphan imports
- [ ] `CLAUDE.md` updated (tab list + schema bullet)
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**Deleted:** everything in §1 (≈15 files + 3 dirs).
**Modified:** the 6 tab-registration files, `scope/page.tsx` (redirect), `lib/oauth/google.ts`,
`CLAUDE.md`, `packages/db/src/schema.ts`, `packages/db/src/relations.ts`.
**New:** one generated migration in `packages/db/drizzle/migrations/`.
