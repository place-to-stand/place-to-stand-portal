# 07: Thread Detail Sheet & Lead Creation

> Part of [PRD 009: Inbox Classification & Triage](./README.md)
> Phase: **4 — Thread Detail Sheet & Lead Creation**
> Dependencies: [02-data-model.md](./02-data-model.md) (classification column, dismiss-unlinks behavior)

## Thread Detail Sheet Update

The existing thread detail sheet (`app/(dashboard)/my/inbox/_components/thread-detail-sheet.tsx`) gains a classification badge and reclassification controls:

- **Classification badge** in the thread header area showing current state (UNCLASSIFIED / CLASSIFIED / DISMISSED)
- **Reclassify action**: ability to change classification (e.g., undo a dismiss, or dismiss a previously linked thread)
- Dismissing a linked thread also removes all links (per [02-data-model.md §Dismiss Unlinks](./02-data-model.md#dismiss-unlinks))
- Undoing a dismiss sets classification back to `UNCLASSIFIED` (thread returns to triage queue)
- Changing classification updates `classified_by` and `classified_at`

This is a lightweight addition to the existing sheet — no structural changes to the panels.

## Lead Creation in Triage

When the Lead track is selected in triage and no existing lead matches, the user clicks **"Create Lead"** which opens the existing lead creation sheet (same one used on `/leads`). The sheet pre-fills:
- **Name** from the sender's `fromName`
- **Email** from the sender's `fromEmail`
- **Source** set to `EMAIL`

After creation, the triage card auto-links the thread to the new lead and the user can accept.

> **Why not inline?** The lead creation sheet already handles validation, required fields, and edge cases. Duplicating that in triage mode adds complexity for marginal speed gain. Most triage actions are accept/dismiss — lead creation is the exception.

## Implementation Checklist (Phase 4)

1. Add classification badge component (pill/tag showing UNCLASSIFIED / CLASSIFIED / DISMISSED)
2. Add badge to thread detail sheet header area
3. Add reclassify action (dropdown or button group) to thread detail sheet
4. Wire reclassify to `PATCH /api/threads/[threadId]` with dismiss-unlinks behavior
5. Add "Create Lead" button to triage card lead track (no-match state)
6. Wire lead creation sheet to accept `prefill` props (name, email, source)
7. Auto-link thread to newly created lead on sheet close
