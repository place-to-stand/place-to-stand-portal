# PRD 004 — Architecture & Product Review

Audited 2026-08-08 (post-consistency-pass). Two roles: Principal Engineer (code-verified) and Product Manager (brand/usage-verified via placetostandagency.com). All findings below are **resolved** — folded into the section files; codes are referenced inline there. All file paths under `apps/internal/` unless workspace-qualified.

## Verification summary

Every load-bearing PRD claim was checked against the actual codebase. Confirmed: the `command.tsx` DialogHeader-outside-DialogContent bug (real, `components/ui/command.tsx` CommandDialog); stale `h-10` tabs; padding-derived button heights; byte-for-byte `updateParams` duplication (users L42 / submissions L48); `⌘[`/`⌘]` handlers using `metaKey || ctrlKey` in both header components; 12 nav items / 5 groups; unused `--sidebar-*` tokens (24 refs in globals.css); API-compatible `hooks/use-mobile.ts`; zero importers for `alert.tsx`/`scroll-area.tsx`; orphaned `use-board-assigned-filter.ts` (2 files, no renderer); `DEFAULT_STATUS_FILTER`/`'none'` sentinel; dual `AppShellHeader` branches in projects-board (L132/L159); `requireUser()` in the dashboard layout (gates `/design` for free); `@pts/db` source-exports precedent for `@pts/ui`; `reactCompiler: true` and no `transpilePackages` yet in next.config.

## Engineering findings

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| C– | — | None. No schema changes, no RLS assumptions, no missing packages, no revalidation gaps found. | — |
| W1 | Warning | Section 01 linked `projects-board.tsx` at `_components/projects-board.tsx`; it actually lives at `apps/internal/app/(dashboard)/projects/projects-board.tsx`. | Path corrected in 01. |
| W2 | Warning | `buildSearchCondition` is **not one shared helper** — per-entity copies live in `lib/queries/{clients,contacts}/settings/pagination.ts`; projects inlines the shared primitive `createSearchPattern` (`lib/pagination/cursor.ts:73`) in `listing.ts:86–97`. "Extending search" to users/invoices/hour-blocks means new per-entity conditions built on `createSearchPattern`. | Wording corrected in 01 + 03. |
| W3 | Warning | `createSearchPattern` maps whitespace→`%` (fuzzy) and does **not** escape `%`/`_`. TEST-PLAN asserted escaping. **Decision (Jason): accept the existing fuzzy semantics everywhere** — table search, palette, and existing archive search stay identical. | TEST-PLAN 01.E2 rewritten to assert no-error + sane results, not escaping. |
| W4 | Warning | Button `lg` size also lacks a fixed height; 04 listed only default/sm/xs. | `lg: h-10` added to 04's button fix. |
| W5 | Warning | Palette API input validation unspecified; route convention (`api/tasks/[taskId]/time-logs`) zod-parses inputs. | 01 now requires zod-parsing `q` (trim, 2–100 chars) before querying. |
| I1 | Info | `userSortExpression` is defined in `lib/queries/users/fields.ts` and consumed in `settings.ts` (order + both cursor conditions, ~L61–109) — the sort "seam" spans two files. | Noted in 03. |
| I2 | Info | `alert.tsx` / `scroll-area.tsx` zero-importer status re-verified at audit time. | Safe deletes stand in 04. |
| I3 | Info | Envelope split: CLAUDE.md prescribes `{ok,data}`; PRD 003's tasks route deliberately returns bare payloads per `api/tasks/` convention. Palette's new `api/command-palette/` namespace uses `{ok,data}` — consistent within its namespace. | No change. |
| I4 | Info | `/design` needs zero gating code — dashboard layout `requireUser()` covers it; CLIENT sessions bounce at sign-in. | No change. |
| I5 | Info | `CommandDialog` already accepts `title`/`description` props — palette gets its accessible name for free once the a11y fix lands. | No change. |

## Product findings

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| PW1 | Warning | ⌘K discoverability: the visible header search affordance existed only in design prose — not in acceptance criteria or tests. It replaces a *visible* control, so the entry point (with a `⌘K` hint) must be part of the contract. | Pinned in 01 design + acceptance criteria; test added. |
| PW2 | Warning | `Ctrl+K` parity unspecified for non-Mac hardware. Existing `⌘[`/`⌘]` handlers already accept `metaKey \|\| ctrlKey`; shadcn's sidebar `⌘B` does too. | 01 spec + tests updated: palette opens on `⌘K` **and** `Ctrl+K`. |
| PW3 | Warning | Default-sort visibility undecided. **Decision (Jason): the default-sorted column always shows its direction arrow on load** — sort state is always visible. | 03 `SortableTableHead` spec + tests updated. |
| PI1 | Info | Palette empty state copy unspecified. | 01 notes `CommandEmpty` with "No results for '…'". |
| PI2 | Info | Deferred priorities are right; the mobile-nav fix riding on sidebar adoption is the biggest hidden product win. | No change. |
| PI3 | Info | Guardrail: while `@pts/ui` exists with the client portal unadopted, no *new* component copies into `apps/client/` — the five existing copies are frozen. | Noted in 04 + 06. |

## Post-implementation findings (UF)

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| UF1 | Critical (shipped broken) | The Base UI migration crashed every dashboard page at runtime: `DropdownMenuLabel` mapped to `Menu.GroupLabel`, which Base UI **runtime-enforces** must sit inside `<Menu.Group>` — Radix's `Label` was free-standing, and user-menu's `forceMount` meant the invalid composition rendered during SSR of the layout. Compile-time gates (tsc/lint/`next build`) cannot see Base UI's context invariants, and the implementation session stopped at those gates. | Both label wrappers (`DropdownMenuLabel`, `SelectLabel` — same trap) rebuilt as plain styled divs (Radix-equivalent semantics, valid anywhere). Full sweep of Base UI's `"Context is missing"` invariants run against every wrapper/consumer composition. **New regression harness:** `apps/internal/scripts/smoke-render-ui.tsx` SSR-renders all 21 ported-component compositions (open/forceMount states included) — catches this entire error class without a browser; run it after any `@pts/ui` primitive change. Also surfaced by the harness: four package files missing the conventional `import * as React` (breaks non-Next consumers) and a misplaced `'use client'` directive. |

## Decisions taken during audit

1. **W3 → accept fuzzy search semantics** (no wildcard escaping); keep all three surfaces identical.
2. **PW3 → always-visible sort arrow** on the default-sorted column.

## Multi-reviewer pass (post-submission, PR #112)

Three reviewers ran against the PR: Claude code-reviewer (0 findings — verified all prior claims), Codex standard (2), Codex adversarial (5). All 7 triaged as Fix by Jason; resolutions folded into the section files with R# codes.

| # | Source | Sev | Finding | Resolution |
|---|--------|-----|---------|------------|
| R1 | Codex std | P2 | Palette route spec said `getCurrentUser()` + `assertAdmin()`, but `getCurrentUser()` returns `AppUser \| null` — fails type-check or returns 403 where 401 is required. | 01: explicit null → 401 before `assertAdmin(user)`, matching the existing route convention. |
| R2 | Codex std | P2 | `sort` in the `useListParams` schema fed `hasActiveFilters` — sort-only changes would fake "Showing N of M"/filtered-empty; projects' implicit clean-URL status default would be missed. | 03: filter/search keys declared separately from `sort` with per-key normalized defaults; `sort` excluded from `hasActiveFilters` by construction. |
| R3 | Codex adv | High | Palette project search would expose other admins' PERSONAL projects — verified: today's switcher excludes them (`projects-landing-header.tsx:63`); the raw listing search does not. | 01: explicit visibility predicate (PERSONAL → own only) inside the palette query; two-admin test added; every 03-added entity must state its visibility predicate. |
| R4 | Codex adv | High | Legacy/PageShell coexistence inferred shell mode from portal content — post-hydration state (`headerContent` set in `useEffect`) → SSR-headerless unconverted pages, CLS, no header on hydration failure. | 01: mechanical commit converts all `AppShellHeader` uses to a page-owned `LegacyPageHeader` and deletes the portal + shared row up front; header ownership server-known in every intermediate state. |
| R5 | Codex adv | High | Sort spec omitted the cursor **encoding** contract — cursors carry fixed payloads (`{name,id}`); new sort fields without matching encode/decode produce duplicate/skipped/empty pages; null policy + tie-breaker unspecified. | 03: full per-sort descriptor (orderBy both directions, typed field-tagged encode/decode with mismatch rejection, null policy, mandatory `id` tie-breaker) + tests for duplicates/nulls/both directions/stale cursors. |
| R6 | Codex adv | Medium | "Only additive API changes" is false for Base UI migrations — Base UI composes via render-prop, not Radix `asChild`; many `*Trigger asChild` consumers exist. | 04: per-component consumer inventory; wrapper preserves the current public API (incl. `asChild` composition) or all call-site changes ship in the same commit; keyboard/focus verification required; impractical preservation → component moves to stay-Radix list. |
| R7 | Codex adv | Medium | Palette parity gap: the retired switcher searches client *and* project names with grouped labels; the spec searched project name/slug only, capped at 8. | 01: project palette query matches client name (join), results labeled `Client · Project`, alphabetical ranking, per-group cap. **Partial skip:** the reviewer's "keep combobox headers until parity tests pass" was rejected — it contradicts locked D2/D13; parity ships in the same section instead. |
