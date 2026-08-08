# 01 — Task Sheet Stays Open on Save

**Depends on:** Nothing
**Blocked by this:** [02-task-sheet-time-logs.md](02-task-sheet-time-logs.md)
**App:** `apps/internal/`
**Decisions:** D1, D2, D3 (see [README.md](README.md))
**Review codes:** C1, C2, C3, C4, C7, W1, W2, W13, W15, I2 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

Saving a task closes the sheet unconditionally — `handleFormSubmit` in
[apps/internal/lib/projects/task-sheet/use-task-sheet-state.ts](../../../apps/internal/lib/projects/task-sheet/use-task-sheet-state.ts)
calls `onOpenChange(false)` (line ~247) for both create and edit. Kris and Jason: "annoying when you
want to create the task and then go straight into planning." The Planning panel is gated on a
persisted task (`props.task` + project GitHub repos in
[task-sheet.tsx](<../../../apps/internal/app/(dashboard)/projects/task-sheet.tsx>) ~L222–224, ~L379–386),
so today "create then plan" is structurally impossible: the sheet closes, and even reopened it would
be a different instance.

Compounding this, the save action discards the id it just created —
[save-task.ts](<../../../apps/internal/app/(dashboard)/projects/actions/save-task.ts>) has `insertedId`
in hand (~L108/117) but `return {}` (~L381) — so the client can't know which task was created.

## Fix

Remove the auto-close on the two primary surfaces (My Tasks, project board). After a **create**, the
sheet transitions into **edit mode**: the consumer pushes the new task id into the URL, the `task`
prop arrives on re-render, and the sheet re-baselines — Planning and (after 02) time logging become
available immediately. After an **edit save**, the sheet simply stays open with a clean form. The
lead task overlay (create-only quick-capture over the lead sheet) keeps the old behavior via an
opt-out prop.

Every other sheet in the app (invoice, lead, client, project, user, contact, hour-block) keeps
close-on-save — the task sheet is the deliberate exception (D1). Prior art for a per-action close
policy: PRD 001 §04 (Acknowledge keeps the submission sheet open; Archive closes it).

## Implementation

### 1. `saveTask` returns the created id (D2)

[apps/internal/app/(dashboard)/projects/actions/save-task.ts](<../../../apps/internal/app/(dashboard)/projects/actions/save-task.ts>)

- **(W2)** `ActionResult` is shared by 9 sibling actions via `actions/action-types.ts` — do NOT
  widen it. Declare a local `export type SaveTaskResult = ActionResult & { taskId?: string }`,
  exactly mirroring the existing prior art `CreateLeadTaskResult` in
  `apps/internal/app/(dashboard)/leads/_actions/create-lead-task.ts:28`. `saveTask` has exactly one
  caller (`use-task-sheet-state.ts` ~L222, re-exported via `projects/actions.ts`) — safe to widen.
- Create path: `return { taskId: insertedId }` (assigned ~L108, null-checked ~L117). Edit path:
  `return { taskId: id }` (harmless, keeps the shape uniform). The terminal `return {}` is ~L381,
  after `revalidateProjectTaskViews()`.

### 2. `use-task-sheet-state.ts` — the core change (D1, D3)

In `handleFormSubmit` (~L210–271):

```ts
// success branch, replacing the close + refresh dance
toast({ title: task ? 'Task updated' : 'Task created', ... })

if (task) {
  // EDIT: stay open, re-baseline so isDirty === false
  form.reset(form.getValues())                          // current values become the new baseline
  resetAttachmentsState({ preservePending: true })      // C7: attachmentsDirty must clear too
  router.refresh()
} else if (closeOnSave) {
  // Lead overlay path: legacy behavior
  resetFormState({ preservePending: true })
  onOpenChange(false)
  router.refresh()
} else {
  // CREATE: hand the id to the consumer; it navigates to edit mode
  onTaskCreated?.(result.taskId)
  router.refresh()
}
```

Specifics:

- **New hook/props options:** `closeOnSave?: boolean` (default `false`) and
  `onTaskCreated?: (taskId: string) => void`, plumbed through `TaskSheet` props in
  [task-sheet.tsx](<../../../apps/internal/app/(dashboard)/projects/task-sheet.tsx>) (props interface
  ~L35–49). Thread them through `UseTaskSheetStateArgs` (~L49–63), the hook's return type, and
  `handleFormSubmit`'s dependency array (~L262–270).
- **Delete the `pendingRefreshRef` mechanism** (ref ~L119, `previousPathnameRef` ~L120, effect
  ~L176–191, set-site ~L252): it existed because the close and the URL change raced; with the sheet
  open, a direct `router.refresh()` is safe (D3).
- **(C4) One consolidated re-baseline rule — reset only when `task?.id` CHANGES.** Do not add a
  second reset effect naively: the existing open-effect (~L165–173) deps include `resetFormState`,
  whose identity changes whenever `defaultValues` → `task` changes — so it **already re-fires on
  task-prop changes** while open. Two competing resets racing is the hazard. Consolidate: the reset
  chain must fire when (a) `open` flips true, or (b) `task?.id` differs from the previous id
  (create→edit arrival, or switching tasks) — and must NOT fire on same-id identity changes (e.g.
  the `router.refresh()` a time-log save triggers in 02, which would otherwise wipe unsaved task
  edits). Track the previous id in a ref. `defaultValues` memoization:
  [use-task-sheet-form.ts](../../../apps/internal/lib/projects/task-sheet/hooks/use-task-sheet-form.ts) (~L42–62).
- **(C7) Edit-save re-baseline covers attachments too:** `useUnsavedChangesWarning` is fed
  `form.formState.isDirty || attachmentsDirty` (~L150–153), so `form.reset(form.getValues())` alone
  leaves the discard prompt armed. Also call `resetAttachmentsState({ preservePending: true })` on
  save success; verify `useTaskAttachments` behavior across the create→edit transition (it's keyed
  on the `task` prop).
- **(W1) Double-submit guard — there is NO existing `isSubmitting` guard.** The only protection
  today is `submitDisabled = isPending || !canManage || isUploading` (~L328) gating the button and
  ⌘S (`canSave`). Add an explicit `isPending` early-return at the top of `handleFormSubmit`, plus a
  `createdTaskIdRef` that ignores further submits once `onTaskCreated` has fired for this create
  (cleared when `task?.id` arrives or the sheet closes). Without both, a fast ⌘S double-tap creates
  duplicates.
- **(W13) Create→edit remounts the editor:** `editorKey` goes `'new-task'` → `task.id`
  (`use-task-sheet-form.ts` ~L69–71) and `historyKey` likewise (`task-sheet.tsx` ~L108), so the
  TipTap editor remounts and the undo/redo history resets at the transition. Content is preserved
  (it re-renders from the saved task). Expected behavior — listed in acceptance criteria.
- **Unsaved-changes guard unaffected:** `handleSheetOpenChange` (~L193–208) still routes
  user-initiated closes through `confirmDiscard`; after a successful save the form is clean, so
  closing is frictionless. Delete/archive close paths (`handleConfirmDelete` ~L289–313) are
  unchanged.
- **⌘S** (`useSheetFormControls.onSave` → `handleSave` in `task-sheet.tsx` ~L110–121) flows through
  the same submit handler — no separate change needed.
- **(I2, cosmetic)** The board's PostHog `TASK_SHEET_OPEN` interaction ends on open/close
  transitions; a never-closing sheet reports `mode: 'create'` past the transition. Accepted
  telemetry drift; no change in this PRD.

### 3. Consumers navigate to the created task

**My Tasks** — [apps/internal/components/my-tasks/my-tasks-page.tsx](../../../apps/internal/components/my-tasks/my-tasks-page.tsx)
and [my/tasks/[view]/[[...taskId]]/page.tsx](<../../../apps/internal/app/(dashboard)/my/tasks/[view]/[[...taskId]]/page.tsx>):

**(C1) The server page must resolve the active task by id.** Today resolution is client-side only:
the page passes `activeTaskId` through as a bare string and `my-tasks-page.tsx` looks it up in
`buildTaskLookup(projects)` (~L77, ~L154–155), where `projects` comes from
`listAssignedTaskSummaries` — **projects with at least one task assigned to the selected assignee**.
A task created in a project outside that set (e.g. created unassigned-to-self, the delegation case)
never resolves: the sheet silently renders create mode with the new id in the URL, and a second
save duplicates. Fix in the server page: when `activeTaskId` is set and its project isn't in the
assigned set, fetch the task's project (with relations, same shape as `fetchProjectsWithRelations`
rows) by the task id and merge it into the `projects` payload. This also future-proofs deep links
to any task URL from My Tasks.

**(C2) Transition ordering** — do NOT clear the create context before navigation; the render-time
re-sync (~L99–107) runs `setIsSheetOpen(Boolean(activeTaskId))` when `createTaskContext` is null,
and at that instant `activeTaskId` is still null → the sheet visibly starts closing and arms the
300ms unmount (~L158–183). Sequence:

```ts
const justCreatedTaskIdRef = useRef<string | null>(null)

const handleTaskCreated = useCallback((taskId: string) => {
  justCreatedTaskIdRef.current = taskId
  router.push(buildViewPath(view, taskId))   // buildViewPath: local useCallback ~L187–195 (keeps ?assignee=)
}, [router, view])

// In the render-time re-sync: while justCreatedTaskIdRef.current is set, keep the sheet open;
// once activeTaskId === justCreatedTaskIdRef.current, clear the ref AND setCreateTaskContext(null).
```

**(W15)** This gating also prevents the transient `defaultProjectId === null` frame:
`defaultProjectId` is `createTaskContext?.projectId ?? editingTaskMeta?.project.id ?? null`
(~L357–359), so the context must survive until `editingTaskMeta` resolves.

**Project board** — [apps/internal/lib/projects/board/state/use-board-sheet-state.ts](../../../apps/internal/lib/projects/board/state/use-board-sheet-state.ts):

**(C3) Mirror `handleEditTask` (~L157–176), not just its navigation call.** `handleEditTask` sets
`setRouteTaskId(task.id)` and `setPendingTaskId(task.id)` *before* `navigateToProject` —
`pendingTaskId` is what stops the sync effect (~L98–100) from closing the sheet during navigation.
Additionally, the sync effect only sets `sheetTask` when `findTaskAcrossProjects(projects, id)`
finds it — and the fresh task isn't in `projects` until `router.refresh()` lands:

```ts
const handleTaskCreated = useCallback((taskId: string) => {
  setRouteTaskId(taskId)
  setPendingTaskId(taskId)                          // keeps the sheet open through navigation
  navigateToProject(projectId, { taskId })          // NavigateOptions: { taskId, replace?, view? }
}, [...])
// The sheet stays on the current form values until the refreshed `projects` prop delivers the
// task and the sync effect sets sheetTask (one refresh cycle). The C4 reset rule (fires on
// task?.id CHANGE) re-baselines exactly once when it arrives.
```

Wire through [projects-board-dialogs.tsx](<../../../apps/internal/app/(dashboard)/projects/_components/projects-board-dialogs.tsx>) (~L80–92).
The board's URL builder lives in [board-utils.ts](../../../apps/internal/lib/projects/board/board-utils.ts) (~L175–179).

**Lead overlay** — [lead-task-sheet-overlay.tsx](<../../../apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-task-sheet-overlay.tsx>) (~L90–102):
pass `closeOnSave` — behavior identical to today. No `onTaskCreated`.

## Architecture notes

- The sheet's open/close model is hybrid (URL owns the active task, local state owns visibility,
  re-synced during render). This section leans into that: create→edit is *just navigation*, no new
  state machine.
- My Tasks defers unmount 300ms for the close animation (~L158–183) — untouched; the sheet never
  closes on this path anymore.

## Acceptance criteria

- [ ] Creating a task from My Tasks keeps the sheet open; the URL becomes `/my/tasks/{view}/{taskId}`; the sheet header reads "Edit task"; Planning is available (when the project has GitHub repos)
- [ ] Creating a task from the project board keeps the sheet open; the URL gains the task id; sheet is in edit mode
- [ ] Saving an edit (button or ⌘S) keeps the sheet open, shows the "Task updated" toast, and the form is clean (`isDirty` false — closing immediately afterward does NOT prompt to discard)
- [ ] After create→edit transition, saving again **updates** the task (no duplicate row)
- [ ] Rapid double-submit during create produces exactly one task
- [ ] Creating a task **unassigned to self** from My Tasks still transitions cleanly into edit mode (C1: the server page resolves it by id)
- [ ] The create→edit transition shows no flicker of the sheet closing (C2) and no transient empty-project form (W15)
- [ ] After the transition, the description editor shows the saved content; undo history starting fresh is expected (W13)
- [ ] Creating a task from the lead sheet's task overlay still closes the overlay on save (unchanged)
- [ ] Board and My Tasks lists reflect the new/edited task without a manual reload (`router.refresh()` fired)
- [ ] Closing the sheet with unsaved changes still prompts; delete/archive still closes the sheet
- [ ] All other sheets (invoice, client, project, user, contact, hour-block, lead) still close on save — no shared code regressed
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**Modified:**
- `apps/internal/app/(dashboard)/projects/actions/save-task.ts` (local `SaveTaskResult`)
- `apps/internal/lib/projects/task-sheet/use-task-sheet-state.ts`
- `apps/internal/lib/projects/task-sheet/hooks/use-task-sheet-form.ts` (only if re-baseline logic lives here)
- `apps/internal/app/(dashboard)/projects/task-sheet.tsx` (new props)
- `apps/internal/components/my-tasks/my-tasks-page.tsx` (C2 gating + `handleTaskCreated`)
- `apps/internal/app/(dashboard)/my/tasks/[view]/[[...taskId]]/page.tsx` (C1 by-id task/project resolution)
- `apps/internal/lib/projects/board/state/use-board-sheet-state.ts` (C3)
- `apps/internal/app/(dashboard)/projects/_components/projects-board-dialogs.tsx`
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-task-sheet-overlay.tsx`
