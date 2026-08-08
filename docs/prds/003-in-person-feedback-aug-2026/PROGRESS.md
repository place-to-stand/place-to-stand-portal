# PRD 003 — Implementation Progress

Update this file after each coding session. Mark items as they land; note deviations inline.

## Pre-implementation checklist

- [x] Read [README.md](README.md) decisions D1–D10
- [x] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — all C#/W# findings are resolved and folded into the section files; the codes below reference it
- [x] `DATABASE_URL` configured; `npm run db:migrate` current (baseline + through 0057)
- [x] Worktree note: fresh worktrees need `.env.local` copied and a build to generate `next-env.d.ts` (see project memory) — done via `next typegen`
- [x] Confirm implementation order: 01 → 02; 03/04/05 in any order or parallel

## 01 — Task sheet stays open ([01-task-sheet-stay-open.md](01-task-sheet-stay-open.md))

- [x] `saveTask` returns `taskId` via local `SaveTaskResult` (mirrors `CreateLeadTaskResult`) (D2, W2)
- [x] `use-task-sheet-state.ts`: auto-close removed; `closeOnSave` + `onTaskCreated` options threaded through args/return/deps (D1)
- [x] `pendingRefreshRef` pathname-wait mechanism deleted; direct `router.refresh()` (D3)
- [x] Consolidated re-baseline rule: reset fires only on `open` flip or `task?.id` CHANGE — never on same-id prop identity changes; no competing second effect (C4)
- [x] Edit save re-baselines form AND attachments (`resetAttachmentsState({ preservePending: true })`) — no discard prompt after save (C7)
- [x] Double-submit guard: **synchronous** `submitLockRef` set before `startTransition` (cleared on settle) + `createdTaskIdRef` (W1, R1)
- [x] Partial-failure contract: post-insert errors return `{ taskId, error }`; client treats as created, never re-inserts on retry (R1)
- [x] My Tasks server page validates `activeTaskId` as UUID (invalid → no active task), then resolves it by id when outside the assigned set and merges its project into the payload (C1, R2)
- [x] My Tasks: `handleTaskCreated` pushes URL first; `justCreatedTaskId` state gates the re-sync (React Compiler lint forbids ref reads during render, so the ref became state); create context cleared only once the task resolves (C2, W15)
- [x] Board: `handleTaskCreated` mirrors `handleEditTask` — `setRouteTaskId` + `setPendingTaskId` + `navigateToProject` (C3); `onTaskCreated` carries `(taskId, projectId)` so a cross-project create navigates to the right board
- [x] Lead overlay passes `closeOnSave`; behavior unchanged
- [x] Delete/archive close paths unchanged; unsaved-changes guard unchanged
- [x] Build / lint / type-check pass; TEST-PLAN §01 walked (programmatically verifiable items)

## 02 — Time logs on the task sheet ([02-task-sheet-time-logs.md](02-task-sheet-time-logs.md))

- [x] `hydrateTimeLogEntries` extracted from `listProjectTimeLogs`, including the missing `timeLogTasks.deletedAt` filter (deliberate live-bug fix) (C6)
- [x] `listTaskTimeLogs(user, taskId)` query — `ensureTaskAccess` inside the query, first line (log ids via `time_log_tasks` → shared hydration; SQL-summed total) (D5, R3)
- [x] `createTimeLog`/`updateTimeLog`: in-transaction linked-task eligibility validation (not deleted, not ARCHIVED; accepted allowed) (R6)
- [x] `GET /api/tasks/[taskId]/time-logs` with `ensureTaskAccess`; **bare payload** per `api/tasks/` convention, generic `HttpError` mapping (W3, I5)
- [x] `use-task-time-logs.ts` React Query hook (`['task-time-logs', taskId]`, explicit `staleTime: 0`) (W14)
- [x] `time-log-section.tsx`: list + total + empty/loading/error states; edit-mode only
- [x] "Log time" button → dialog create mode; pre-link via dedicated `open && !isEditMode` effect seeding selection AND baseline (C5; baseline set via microtask to satisfy the React Compiler set-state-in-effect rule, matching the existing edit-mode effect)
- [x] Pre-linked task bypasses the eligibility filter (accepted tasks work); archived/deleted tasks disable the button (C5)
- [x] Button disabled (tooltip) while project field has unsaved change (D4)
- [x] Row click → dialog edit mode (entry shape matches Time Logs tab's)
- [x] Confirm-guarded Delete in the dialog's edit mode, reusing the existing DELETE endpoint + activity event (W5)
- [x] `onSuccess` threaded through mutation hook + dialog hook + dialog props → invalidate task-time-logs key; sheet stays open; unsaved task edits survive (W6, C4)
- [x] Shared dialog-params builder extracted from `projects-board-dialogs.tsx` L94–110 into `lib/projects/time-log/dialog-params.ts`; params built lazily inside the `props.task &&` branch (W4)
- [x] Works from My Tasks and project board (same TaskSheet component; both consumers hold `ProjectWithRelations`); overage confirm + activity events ride the reused dialog/mutation path
- [x] Build / lint / type-check pass; TEST-PLAN §02 walked (programmatically verifiable items)

## 03 — Remove scope tab ([03-remove-scope-tab.md](03-remove-scope-tab.md))

- [x] §1 deletions complete (scope components, `components/scope/sow-status-cell.tsx`, `lib/scope/`, `actions/sow.ts`, `lib/queries/sow.ts`, `lib/google/` (all under `apps/internal/`), picker route, `google-picker.d.ts` + now-empty `types/` dir; `sow-parser-types.ts` deleted by path) (I1)
- [x] Tab registration excised across all 6 board files — named-line deletes only (kept `activityDisabled`/`reviewDisabled`/`timeLogsDisabled` intact) (W7); `use-projects-board-view-model.ts` L73 compound conditional edited correctly (timeLogs/overview → 'board' fallback preserved)
- [x] `scope/page.tsx` → redirect to `/tasks`, sibling `PageProps` convention (D7, I1)
- [x] `apps/internal/lib/oauth/google.ts`: `GOOGLE_DOCS_SCOPES` / `hasDocsScopes` removed; `GOOGLE_SCOPES` untouched (D8)
- [x] Final grep sweep clean (precise strings; zero hits for `ScopeTabContent|sow-status|picker-token|use-google-picker|scopeHref|scopeDisabled|scopeProjectId|GOOGLE_DOCS_SCOPES|projectSows|sowSnapshots|sowSections`)
- [x] `packages/db` schema + relations blocks removed; migration `0058_remove_sow_tables.sql` generated, SQL reviewed (CASCADE drops make the drop order safe; both enums dropped), applied locally, idempotent re-run verified (D6)
- [x] `CLAUDE.md` updated (2 spots)
- [x] Build / lint / type-check pass; TEST-PLAN §03 walked (programmatically verifiable items)
- [ ] Migration applied to staging, then production <!-- MANUAL STEP for the user: run `npm run db:migrate` (staging DATABASE_URL) then `npm run db:migrate:prod` from packages/db at deploy time — drops sow tables + enums with data (D6, intentional) -->

## 04 — Total-projects hover ([04-clients-total-projects-hover.md](04-clients-total-projects-hover.md))

- [x] Data layer: `ClientProjectSummary` (+`status: ProjectStatusValue`), widened query (status filter dropped), `allProjects` + derived `activeProjects` (D9, I3)
- [x] `apps/internal/components/ui/hover-card.tsx`: optional controlled `open`/`onOpenChange` (backward-compatible) (W8)
- [x] Cell: total span → second HoverCard with status badges (Badge + `getProjectStatusToken` + `getProjectStatusLabel`); both branches with per-branch tones (`/60`, `/50`) (I3)
- [x] Cell coordination: opening one card force-closes the other; controlled opens cancel pending timers; close callbacks clear state via owner-checked functional update (W8, R8)
- [x] Total card list scrolls (`max-h-80 overflow-y-auto`) (W9)
- [x] Links `/projects/.../tasks` for all statuses; slug/id fallbacks
- [x] `clients-landing.tsx` passes `allProjects`; contacts linked-clients hover unaffected (wrapper props optional — verified no other `HoverCard` consumer passes `open`)
- [x] Build / lint / type-check pass; TEST-PLAN §04 walked (programmatically verifiable items)

## 05 — Users filters ([05-users-role-filter.md](05-users-role-filter.md))

- [x] `apps/internal/lib/settings/users/filters.ts` (role + access values/labels/guards via `@/lib/db/schema`; `parseUsersSearchParams` shared helper); `ROLE_LABELS` lifted from `users-table-row.tsx` (D10, W10, W11, I4)
- [x] `users-filters.tsx` (submissions pattern; clears `cursor` + `dir` on change)
- [x] `listUsersForSettings` role/access predicates in `baseConditions` (`eq`/`isNotNull` added to drizzle import); count follows (I4)
- [x] Active page: both filters + `space-y-4`; archive page: role only; both use the shared parse helper
- [x] Pagination preserves filters (`handlePaginate` clones existing URLSearchParams — verified, no change needed); filter change resets pagination
- [x] Filtered empty-state message (detect via existing `useSearchParams()`, values run through `isUserRole`/`isUserAccess` guards — no prop drilling) (I4, R4)
- [x] Build / lint / type-check pass; TEST-PLAN §05 walked (programmatically verifiable items)

## Post-implementation

- [ ] [TEST-PLAN.md](TEST-PLAN.md) fully walked, regressions section included <!-- MANUAL STEP for the user: 78 remaining items are interactive browser tests — walk them against the dev server (or run /autotest-prd); 4 programmatic items (03.3, 03.4, 03.8, 03.E2) already verified -->
- [x] PRD status flipped from Draft in [README.md](README.md)
