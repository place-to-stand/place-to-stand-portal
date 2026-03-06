# 06: Remove Lead Auto-Linking

> Part of [PRD 010: Transcript Classification & Triage](./README.md)
> Phase: **3 — Remove Lead Auto-Linking**
> Dependencies: None — can run in parallel with any phase

## Background

The leads system currently has "magic" auto-linking that generates LINK_EMAIL_THREAD and LINK_TRANSCRIPT suggestions when a user clicks "Generate Suggestions" on a lead. These suggestions appear in the lead sheet's right column and let users approve/reject linking specific email threads or meeting transcripts to the lead's AI context.

This system is being removed because:

1. **It's opaque** — users don't understand why certain threads/transcripts are suggested
2. **It's redundant** — the inbox triage flow (PRD 009 for emails, this PRD for transcripts) provides a more explicit and reliable classification path
3. **It only works for leads** — no equivalent exists for client projects
4. **It creates invisible state** — approved suggestions modify AI context without clear visibility

All classification will now happen through the inbox triage flow, where the user explicitly assigns every email thread and transcript to a client/project/lead.

## Files to Modify

### 1. `lib/leads/actions/generate-suggestions.ts`

Remove **steps 6 and 7** (auto-create LINK_EMAIL_THREAD and LINK_TRANSCRIPT suggestions):

**Remove step 6** (~lines 194-233): The block that queries existing thread suggestions, filters for new threads, and creates `LinkEmailSuggestedContent` suggestions with `actionType: 'LINK_EMAIL_THREAD'`.

**Remove step 7** (~lines 235-269): The block that queries existing meeting suggestions, filters for new meetings with transcripts, and creates `LinkTranscriptSuggestedContent` suggestions with `actionType: 'LINK_TRANSCRIPT'`.

**Keep steps 1-5**: The AI action suggestion generation (FOLLOW_UP, REPLY, SCHEDULE_CALL, SEND_PROPOSAL, ADVANCE_STATUS) remains unchanged.

**Update the return statement** (~line 273): Remove `newThreadSuggestions.length` and `newTranscriptSuggestions.length` from the `suggestionsCount` total.

### 2. `app/(dashboard)/leads/_components/lead-sheet/lead-sheet-right-column.tsx`

Remove:
- Import of `LeadEmailSuggestionsSection`
- Import of `LeadTranscriptSuggestionsSection`
- `<LeadEmailSuggestionsSection>` JSX (lines ~101-104)
- `<LeadTranscriptSuggestionsSection>` JSX (lines ~106-110)

The right column will still show: Quick Actions, AI Suggestions, Tasks, Meetings, Proposals.

### 3. `lib/types/suggestions.ts`

Remove these types:

```typescript
// DELETE: Content for LINK_EMAIL_THREAD suggestions
export interface LinkEmailSuggestedContent { ... }

// DELETE: Content for LINK_TRANSCRIPT suggestions
export interface LinkTranscriptSuggestedContent { ... }
```

Remove from `LeadActionType` union:
```typescript
// BEFORE:
export type LeadActionType =
  | 'FOLLOW_UP' | 'REPLY' | 'SCHEDULE_CALL' | 'SEND_PROPOSAL'
  | 'ADVANCE_STATUS' | 'LINK_EMAIL_THREAD' | 'LINK_TRANSCRIPT'

// AFTER:
export type LeadActionType =
  | 'FOLLOW_UP' | 'REPLY' | 'SCHEDULE_CALL' | 'SEND_PROPOSAL'
  | 'ADVANCE_STATUS'
```

Remove from `SuggestedContent` union type:
```typescript
// BEFORE:
export type SuggestedContent = ... | LinkEmailSuggestedContent | LinkTranscriptSuggestedContent

// AFTER:
export type SuggestedContent = TaskSuggestedContent | PRSuggestedContent | ReplySuggestedContent | LeadActionSuggestedContent
```

## Files to Delete

| File | Reason |
|------|--------|
| `app/(dashboard)/leads/_components/lead-sheet/lead-email-suggestions-section.tsx` | UI for approve/reject email thread linking — replaced by inbox triage |
| `app/(dashboard)/leads/_components/lead-sheet/lead-transcript-suggestions-section.tsx` | UI for approve/reject transcript linking — replaced by inbox triage |

## Cleanup Review

After the above changes, review these files for any orphaned LINK_EMAIL_THREAD / LINK_TRANSCRIPT references:

- `lib/queries/suggestions.ts` — check for any action-type-specific logic
- `lib/email/matcher.ts` — check if still used by other flows (email triage uses different matchers)
- `lib/leads/scoring.ts` — check if scoring references linked suggestions
- `lib/data/suggestions/index.ts` — check for link suggestion handling

## Existing Suggestion Data

Existing LINK_EMAIL_THREAD and LINK_TRANSCRIPT suggestions in the `suggestions` table should be left in place (soft-delete is not necessary). They are stored as JSONB `suggestedContent` and will simply no longer be generated or displayed. The data is harmless and may be useful for historical reference.

## Implementation Checklist (Phase 3)

1. Modify `lib/leads/actions/generate-suggestions.ts` — remove steps 6 and 7
2. Modify `lead-sheet-right-column.tsx` — remove suggestion section components
3. Modify `lib/types/suggestions.ts` — remove link types and action types
4. Delete `lead-email-suggestions-section.tsx`
5. Delete `lead-transcript-suggestions-section.tsx`
6. Review and clean up orphaned references
7. Run `npm run type-check` — verify no type errors from removed types
8. Run `npm run build` — verify no import errors from deleted files
9. Test: open a lead, generate suggestions → verify only action suggestions appear (no link suggestions)
10. Test: lead sheet right column renders without email/transcript sections
