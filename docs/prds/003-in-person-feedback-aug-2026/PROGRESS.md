# PRD 003 — Implementation Progress

Update this file after each coding session. Mark items as they land; note deviations inline.

## Pre-implementation checklist

- [ ] Read [README.md](README.md) decisions D1–D10
- [ ] Read [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) — all C#/W# findings are resolved and folded into the section files; the codes below reference it
- [ ] `DATABASE_URL` configured; `npm run db:migrate` current (baseline + through 0057)
- [ ] Worktree note: fresh worktrees need `.env.local` copied and a build to generate `next-env.d.ts` (see project memory)
- [ ] Confirm implementation order: 01 → 02; 03/04/05 in any order or parallel

## 01 — Task sheet stays open ([01-task-sheet-stay-open.md](01-task-sheet-stay-open.md))

- [ ] `saveTask` returns `taskId` via local `SaveTaskResult` (mirrors `CreateLeadTaskResult`) (D2, W2)
- [ ] `use-task-sheet-state.ts`: auto-close removed; `closeOnSave` + `onTaskCreated` options threaded through args/return/deps (D1)
- [ ] `pendingRefreshRef` pathname-wait mechanism deleted; direct `router.refresh()` (D3)
- [ ] Consolidated re-baseline rule: reset fires only on `open` flip or `task?.id` CHANGE — never on same-id prop identity changes; no competing second effect (C4)
- [ ] Edit save re-baselines form AND attachments (`resetAttachmentsState({ preservePending: true })`) — no discard prompt after save (C7)
- [ ] Double-submit guard: `isPending` early-return in `handleFormSubmit` + `createdTaskIdRef` (W1)
- [ ] My Tasks server page resolves the active task by id when outside the assigned set and merges its project into the payload (C1)
- [ ] My Tasks: `handleTaskCreated` pushes URL first; `justCreatedTaskIdRef` gates the re-sync; create context cleared only once the task resolves (C2, W15)
- [ ] Board: `handleTaskCreated` mirrors `handleEditTask` — `setRouteTaskId` + `setPendingTaskId` + `navigateToProject` (C3)
- [ ] Lead overlay passes `closeOnSave`; behavior unchanged
- [ ] Delete/archive close paths unchanged; unsaved-changes guard unchanged
- [ ] Build / lint / type-check pass; TEST-PLAN §01 walked

## 02 — Time logs on the task sheet ([02-task-sheet-time-logs.md](02-task-sheet-time-logs.md))

- [ ] `hydrateTimeLogEntries` extracted from `listProjectTimeLogs`, including the missing `timeLogTasks.deletedAt` filter (deliberate live-bug fix) (C6)
- [ ] `listTaskTimeLogs` query (log ids via `time_log_tasks` → shared hydration; SQL-summed total) (D5)
- [ ] `GET /api/tasks/[taskId]/time-logs` with `ensureTaskAccess`; **bare payload** per `api/tasks/` convention, generic `HttpError` mapping (W3, I5)
- [ ] `use-task-time-logs.ts` React Query hook (`['task-time-logs', taskId]`, explicit `staleTime: 0`) (W14)
- [ ] `time-log-section.tsx`: list + total + empty/loading/error states; edit-mode only
- [ ] "Log time" button → dialog create mode; pre-link via dedicated `open && !isEditMode` effect seeding selection AND baseline (C5)
- [ ] Pre-linked task bypasses the eligibility filter (accepted tasks work); archived/deleted tasks disable the button (C5)
- [ ] Button disabled (tooltip) while project field has unsaved change (D4)
- [ ] Row click → dialog edit mode (entry shape matches Time Logs tab's)
- [ ] Confirm-guarded Delete in the dialog's edit mode, reusing the existing DELETE endpoint + activity event (W5)
- [ ] `onSuccess` threaded through mutation hook + dialog hook + dialog props → invalidate task-time-logs key; sheet stays open; unsaved task edits survive (W6, C4)
- [ ] Shared dialog-params builder extracted from `projects-board-dialogs.tsx` L94–110; params built lazily inside the `props.task &&` branch (W4)
- [ ] Works from My Tasks and project board; overage confirm + activity events verified
- [ ] Build / lint / type-check pass; TEST-PLAN §02 walked

## 03 — Remove scope tab ([03-remove-scope-tab.md](03-remove-scope-tab.md))

- [ ] §1 deletions complete (scope components, `components/scope/sow-status-cell.tsx`, `lib/scope/`, `actions/sow.ts`, `lib/queries/sow.ts`, `lib/google/` (all under `apps/internal/`), picker route, `google-picker.d.ts` + now-empty `types/` dir; `sow-parser-types.ts` deleted by path) (I1)
- [ ] Tab registration excised across all 6 board files — named-line deletes only in `projects-board-tabs.tsx` (L44/48/49, L101/105/106, L159/163) and `use-projects-board-navigation.ts` (L58–60 + L64, keeping L61–63) (W7); `use-projects-board-view-model.ts` L73 compound conditional edited correctly
- [ ] `scope/page.tsx` → redirect to `/tasks`, sibling `PageProps` convention (D7, I1)
- [ ] `apps/internal/lib/oauth/google.ts`: `GOOGLE_DOCS_SCOPES` (L40–43) / `hasDocsScopes` (L73–78) removed; `GOOGLE_SCOPES` untouched (D8)
- [ ] Final grep sweep clean (precise strings; expected false positives per section 03)
- [ ] `packages/db` schema + relations blocks removed; migration `remove_sow_tables` generated, SQL reviewed (drop order), applied locally (D6)
- [ ] `CLAUDE.md` updated (2 spots)
- [ ] Build / lint / type-check pass; TEST-PLAN §03 walked
- [ ] Migration applied to staging, then production

## 04 — Total-projects hover ([04-clients-total-projects-hover.md](04-clients-total-projects-hover.md))

- [ ] Data layer: `ClientProjectSummary` (+`status: ProjectStatusValue`), widened query (status filter dropped), `allProjects` + derived `activeProjects` (D9, I3)
- [ ] `apps/internal/components/ui/hover-card.tsx`: optional controlled `open`/`onOpenChange` (backward-compatible) (W8)
- [ ] Cell: total span → second HoverCard with status badges (Badge + `getProjectStatusToken`); both branches with per-branch tones (`/60`, `/50`) (I3)
- [ ] Cell coordination: opening one card force-closes the other (W8)
- [ ] Total card list scrolls (`max-h-80 overflow-y-auto`) (W9)
- [ ] Links `/projects/.../tasks` for all statuses; slug/id fallbacks
- [ ] `clients-landing.tsx` passes `allProjects`; contacts linked-clients hover regression-checked
- [ ] Build / lint / type-check pass; TEST-PLAN §04 walked

## 05 — Users filters ([05-users-role-filter.md](05-users-role-filter.md))

- [ ] `apps/internal/lib/settings/users/filters.ts` (role + access values/labels/guards via `@/lib/db/schema`; `parseUsersSearchParams` shared helper); `ROLE_LABELS` lifted from `users-table-row.tsx` (D10, W10, W11, I4)
- [ ] `users-filters.tsx` (submissions pattern; clears `cursor` + `dir` on change)
- [ ] `listUsersForSettings` role/access predicates in `baseConditions` (`eq`/`isNotNull` added to drizzle import); count follows (I4)
- [ ] Active page: both filters + `space-y-4`; archive page: role only; both use the shared parse helper
- [ ] Pagination preserves filters; filter change resets pagination
- [ ] Filtered empty-state message (detect via existing `useSearchParams()` — no prop drilling) (I4)
- [ ] Build / lint / type-check pass; TEST-PLAN §05 walked

## Post-implementation

- [ ] [TEST-PLAN.md](TEST-PLAN.md) fully walked, regressions section included
- [ ] PRD status flipped from Draft in [README.md](README.md)
