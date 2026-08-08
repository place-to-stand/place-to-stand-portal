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

## Decisions taken during audit

1. **W3 → accept fuzzy search semantics** (no wildcard escaping); keep all three surfaces identical.
2. **PW3 → always-visible sort arrow** on the default-sorted column.
