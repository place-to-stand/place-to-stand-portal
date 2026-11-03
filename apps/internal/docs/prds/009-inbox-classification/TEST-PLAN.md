# PRD 009: Manual Test Plan

> Updated after each coding session. Test cases are added as features are implemented.
> Mark tests ✅ when passing, ❌ when failing, ⏭️ when not yet testable.

## Phase 1: Data Model & Sync Changes

### Schema & Migration

| #   | Test Case                                                                                   | Status | Notes |
| --- | ------------------------------------------------------------------------------------------- | ------ | ----- |
| 1.1 | `classification` column exists on `threads` with default `UNCLASSIFIED`                     | ⏭️     |       |
| 1.2 | `classified_by` and `classified_at` columns exist on `threads`                              | ⏭️     |       |
| 1.3 | Existing linked threads (clientId/projectId/leadId non-null) are backfilled to `CLASSIFIED` | ⏭️     |       |
| 1.4 | Backfilled rows have `classified_by = NULL` and `classified_at = now()`                     | ⏭️     |       |
| 1.5 | Existing unlinked threads remain `UNCLASSIFIED`                                             | ⏭️     |       |

### Auto-Classify on Link

| #    | Test Case                                                        | Status | Notes |
| ---- | ---------------------------------------------------------------- | ------ | ----- |
| 1.6  | Linking a thread to a client sets `classification = CLASSIFIED`  | ⏭️     |       |
| 1.7  | Linking a thread to a project sets `classification = CLASSIFIED` | ⏭️     |       |
| 1.8  | Linking a thread to a lead sets `classification = CLASSIFIED`    | ⏭️     |       |
| 1.9  | `classified_by` is set to the current user on link               | ⏭️     |       |
| 1.10 | `classified_at` is set to current timestamp on link              | ⏭️     |       |
| 1.11 | Approving a suggestion sets `classification = CLASSIFIED`        | ⏭️     |       |

### Revert on Unlink

| #    | Test Case                                                             | Status | Notes |
| ---- | --------------------------------------------------------------------- | ------ | ----- |
| 1.12 | Unlinking all three (client, project, lead) reverts to `UNCLASSIFIED` | ⏭️     |       |
| 1.13 | Unlinking client while project still linked keeps `CLASSIFIED`        | ⏭️     |       |
| 1.14 | `classified_by` and `classified_at` are cleared on full unlink        | ⏭️     |       |

### Dismiss Unlinks

| #    | Test Case                                                                      | Status | Notes |
| ---- | ------------------------------------------------------------------------------ | ------ | ----- |
| 1.15 | Dismissing a linked thread removes clientId, projectId, and leadId             | ⏭️     |       |
| 1.16 | Dismissing sets `classification = DISMISSED`, `classified_by`, `classified_at` | ⏭️     |       |

### Sync Changes

| #    | Test Case                                                                        | Status | Notes |
| ---- | -------------------------------------------------------------------------------- | ------ | ----- |
| 1.17 | Gmail sync no longer calls `matchThreadToLead` / `linkThreadToLead`              | ⏭️     |       |
| 1.18 | New synced threads have `classification = UNCLASSIFIED`                          | ⏭️     |       |
| 1.19 | New synced threads have `leadId = NULL` (no auto-linking)                        | ⏭️     |       |
| 1.20 | Sync still creates threads and messages correctly                                | ⏭️     |       |
| 1.21 | Sync still handles incremental sync (history API) correctly                      | ⏭️     |       |
| 1.22 | `leads.lastContactAt` is updated when thread is linked to lead (not during sync) | ⏭️     |       |

## Phase 2: Inbox Views Update

### Unclassified View

| #   | Test Case                                                                | Status | Notes |
| --- | ------------------------------------------------------------------------ | ------ | ----- |
| 2.1 | `/my/inbox/emails/unclassified` shows only `UNCLASSIFIED` threads        | ⏭️     |       |
| 2.2 | `/my/inbox/emails/unlinked` is no longer a valid view (redirects or 404) | ⏭️     |       |
| 2.3 | "Start Triage" button appears when unclassified count > 0                | ⏭️     |       |
| 2.4 | "Start Triage" button links to `/my/inbox/triage`                        | ⏭️     |       |

### Dismissed View

| #   | Test Case                                                   | Status | Notes |
| --- | ----------------------------------------------------------- | ------ | ----- |
| 2.5 | `/my/inbox/emails/dismissed` shows only `DISMISSED` threads | ⏭️     |       |
| 2.6 | Undo dismiss sets thread back to `UNCLASSIFIED`             | ⏭️     |       |

### Sidebar

| #   | Test Case                                             | Status | Notes |
| --- | ----------------------------------------------------- | ------ | ----- |
| 2.7 | Sidebar shows "Unclassified" with correct count badge | ⏭️     |       |
| 2.8 | Sidebar shows "Dismissed" without badge               | ⏭️     |       |
| 2.9 | "Linked" view is removed from sidebar                 | ⏭️     |       |

### Visual Treatment

| #    | Test Case                                                          | Status | Notes |
| ---- | ------------------------------------------------------------------ | ------ | ----- |
| 2.10 | `UNCLASSIFIED` threads show yellow dot in list view                | ⏭️     |       |
| 2.11 | `CLASSIFIED` threads show green dot and entity badges in list view | ⏭️     |       |
| 2.12 | `DISMISSED` threads show greyed out / muted text in list view      | ⏭️     |       |

## Phase 3: Triage Mode UI

### Routing & Entry

| #   | Test Case                                                             | Status | Notes |
| --- | --------------------------------------------------------------------- | ------ | ----- |
| 3.1 | `/my/inbox/triage` renders the triage page                            | ⏭️     |       |
| 3.2 | Triage tab appears first (before Emails) in inbox tab bar             | ⏭️     |       |
| 3.3 | Triage tab badge shows unclassified count                             | ⏭️     |       |
| 3.4 | `/my/inbox/` redirects to `/my/inbox/triage` (or appropriate default) | ⏭️     |       |

### Triage Card — Match Found

| #   | Test Case                                                                             | Status | Notes |
| --- | ------------------------------------------------------------------------------------- | ------ | ----- |
| 3.5 | Thread with client contact match shows "Detected: Client Work" with pre-filled client | ⏭️     |       |
| 3.6 | HIGH confidence match shows ✓ indicator                                               | ⏭️     |       |
| 3.7 | Project dropdown is populated if AI project match found                               | ⏭️     |       |
| 3.8 | "Switch to Lead" link switches the detection panel to lead track                      | ⏭️     |       |

### Triage Card — Lead Match

| #    | Test Case                                                          | Status | Notes |
| ---- | ------------------------------------------------------------------ | ------ | ----- |
| 3.9  | Thread matching a lead shows "Detected: Lead" with pre-filled lead | ⏭️     |       |
| 3.10 | "Switch to Client Work" link switches to client track              | ⏭️     |       |

### Triage Card — No Match

| #    | Test Case                                                                              | Status | Notes |
| ---- | -------------------------------------------------------------------------------------- | ------ | ----- |
| 3.11 | Unknown sender shows "No match found" with "Link to Client" and "Link to Lead" buttons | ⏭️     |       |
| 3.12 | Clicking "Link to Client" expands inline into client/project dropdowns                 | ⏭️     |       |
| 3.13 | Clicking "Link to Lead" expands inline into lead dropdown                              | ⏭️     |       |

### Accept Flow

| #    | Test Case                                                             | Status | Notes |
| ---- | --------------------------------------------------------------------- | ------ | ----- |
| 3.14 | Accept button is disabled when no track/selection is made             | ⏭️     |       |
| 3.15 | Accept button is disabled on client track until client is selected    | ⏭️     |       |
| 3.16 | Accept button is disabled on lead track until lead is selected        | ⏭️     |       |
| 3.17 | Accepting links thread and sets `CLASSIFIED`, advances to next thread | ⏭️     |       |
| 3.18 | Accepting on lead track updates `leads.lastContactAt`                 | ⏭️     |       |
| 3.19 | Client track: project is optional (can accept with just client)       | ⏭️     |       |

### Dismiss & Skip

| #    | Test Case                                         | Status | Notes |
| ---- | ------------------------------------------------- | ------ | ----- |
| 3.20 | Dismiss sets `DISMISSED`, removes links, advances | ⏭️     |       |
| 3.21 | Skip advances without changing classification     | ⏭️     |       |
| 3.22 | Go back returns to previous thread                | ⏭️     |       |

### Keyboard Shortcuts

| #    | Test Case                                              | Status | Notes |
| ---- | ------------------------------------------------------ | ------ | ----- |
| 3.23 | `Enter` triggers accept (when enabled)                 | ⏭️     |       |
| 3.24 | `d` triggers dismiss                                   | ⏭️     |       |
| 3.25 | `→` triggers skip                                      | ⏭️     |       |
| 3.26 | `←` triggers go back                                   | ⏭️     |       |
| 3.27 | `Space` expands/collapses thread content               | ⏭️     |       |
| 3.28 | Shortcuts don't fire when focus is in a dropdown/input | ⏭️     |       |

### Queue & Progress

| #    | Test Case                                                       | Status | Notes |
| ---- | --------------------------------------------------------------- | ------ | ----- |
| 3.29 | Queue is sorted by `lastMessageAt` descending                   | ⏭️     |       |
| 3.30 | Session counter increments on accept and dismiss                | ⏭️     |       |
| 3.31 | Session counter resets when navigating away and back            | ⏭️     |       |
| 3.32 | "All caught up" state shows when no unclassified threads remain | ⏭️     |       |

### Conflict Resolution

| #    | Test Case                                                          | Status | Notes |
| ---- | ------------------------------------------------------------------ | ------ | ----- |
| 3.33 | Thread matching both client and lead defaults to Client Work track | ⏭️     |       |
| 3.34 | User can switch to Lead track via "Switch to Lead"                 | ⏭️     |       |

## Phase 4: Detail Sheet & Lead Creation

### Classification Badge

| #   | Test Case                                                                          | Status | Notes |
| --- | ---------------------------------------------------------------------------------- | ------ | ----- |
| 4.1 | Thread detail sheet shows classification badge (UNCLASSIFIED/CLASSIFIED/DISMISSED) | ⏭️     |       |
| 4.2 | Badge updates when classification changes                                          | ⏭️     |       |

### Reclassify

| #   | Test Case                                                         | Status | Notes |
| --- | ----------------------------------------------------------------- | ------ | ----- |
| 4.3 | Can dismiss a CLASSIFIED thread from detail sheet (removes links) | ⏭️     |       |
| 4.4 | Can undo dismiss from detail sheet (sets to UNCLASSIFIED)         | ⏭️     |       |

### Lead Creation from Triage

| #   | Test Case                                                                   | Status | Notes |
| --- | --------------------------------------------------------------------------- | ------ | ----- |
| 4.5 | "Create Lead" opens lead creation sheet with pre-filled name, email, source | ⏭️     |       |
| 4.6 | After lead creation, triage card auto-links to new lead                     | ⏭️     |       |
| 4.7 | User can then accept the triage card with the new lead                      | ⏭️     |       |

## Phase 5: Batch Actions & Metrics

### Batch Actions

| #   | Test Case                                                        | Status | Notes |
| --- | ---------------------------------------------------------------- | ------ | ----- |
| 5.1 | Can multi-select threads via checkbox                            | ⏭️     |       |
| 5.2 | Shift-click selects a range                                      | ⏭️     |       |
| 5.3 | Floating toolbar appears when threads are selected               | ⏭️     |       |
| 5.4 | Batch dismiss sets all selected to `DISMISSED` and removes links | ⏭️     |       |

### Metrics

| #   | Test Case                                          | Status | Notes |
| --- | -------------------------------------------------- | ------ | ----- |
| 5.5 | Toolbar shows "[count] unclassified" indicator     | ⏭️     |       |
| 5.6 | Clicking indicator navigates to `/my/inbox/triage` | ⏭️     |       |

### PostHog Events

| #    | Test Case                                                                         | Status | Notes |
| ---- | --------------------------------------------------------------------------------- | ------ | ----- |
| 5.7  | `inbox_thread_classified` fires on classify (triage, manual, suggestion_approved) | ⏭️     |       |
| 5.8  | `inbox_triage_started` fires on triage page load                                  | ⏭️     |       |
| 5.9  | `inbox_triage_session_ended` fires on triage navigation away                      | ⏭️     |       |
| 5.10 | `inbox_batch_dismissed` fires on batch dismiss                                    | ⏭️     |       |

## Edge Cases (Cross-Phase)

| #   | Test Case                                                                        | Status | Notes |
| --- | -------------------------------------------------------------------------------- | ------ | ----- |
| E.1 | Thread classified in triage disappears from triage queue on refresh              | ⏭️     |       |
| E.2 | Thread dismissed in triage appears in Dismissed view                             | ⏭️     |       |
| E.3 | Thread dismissed then un-dismissed appears in Unclassified view and triage queue | ⏭️     |       |
| E.4 | Linking a thread from the detail sheet (not triage) also sets CLASSIFIED         | ⏭️     |       |
| E.5 | New emails synced during a triage session appear in queue on next page load      | ⏭️     |       |
| E.6 | Thread with only projectId (no clientId) still counts as CLASSIFIED              | ⏭️     |       |
| E.7 | Rapidly clicking accept doesn't cause double-linking or skipped threads          | ⏭️     |       |
