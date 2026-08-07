# PRD 002 — Architecture & Product Review

Audit run 2026-08-06 (Principal Engineer + Product Manager passes, findings resolved with owner). All Critical/Warning resolutions are incorporated inline in the section files; this document is the audit record.

## Engineering findings

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| C1 | Critical | Section 05 assumed time-log writes go through server actions. They go through **API routes**: `apps/internal/app/api/projects/[projectId]/time-logs/route.ts` (POST) and `.../[timeLogId]/route.ts` (PATCH/DELETE) — no time-log actions dir exists. | 05 rewritten: the closed-month check lives in the route handlers, `warning` rides the JSON response, and the React Query mutation handlers in the time-log sheet surface it as a toast. Hour blocks keep the action-result approach (`ActionResult` in `apps/internal/app/(dashboard)/hour-blocks/actions/types.ts` gains `warning?`). |
| W1 | Warning | `apps/internal/lib/leads/actions/convert-lead.ts` creates clients **by calling the `createClient` action** — the PRD listed it as a second insertion point for the initial terms row. | 01 updated: initial term is inserted only in `create-client.ts`; lead conversion inherits it. Test 01.3 stays as the verification. |
| W2 | Warning | `create-client.ts` has no transaction — it's a slug-retry loop (lines ~68–131) around a bare insert. | 01 updated with guidance: wrap `db.transaction` (client insert + term insert) **inside** the retry loop; a slug unique-violation aborts the tx and the loop retries with a fresh slug. |
| W3 | Warning | `upsertBillingTerm` upserts against a **partial** unique index (`WHERE deleted_at IS NULL`); Postgres won't infer it without the predicate. | 01 updated: `onConflictDoUpdate` must pass `targetWhere: sql\`deleted_at IS NULL\`` (precedent for partial unique indexes at `packages/db/src/schema.ts:671`). |
| W4 | Warning | Month indexing mismatch: the report URL's `month` param is **0-indexed** (`page.tsx` line ~49), while `monthly_close_snapshots.month` and the action zod schemas are **1-indexed**. | 03/04 updated: convert at the page → action boundary (`urlMonth + 1`); zod rejects 0 so a missed conversion fails loudly for January. |
| W5 | Warning | The client sheet consumes snake-case `DbClient` rows (`form-state.ts:93`) — the proposed terms history list had no data path. | **Owner decision: drop the list.** The sheet shows only current type + boundary radio; history lives in the activity feed (every change logs before/after + `effectiveFrom`). `listBillingTerms` removed from the 01 query module. |
| I1 | Info | `VALID_TARGET_TYPES` in `apps/internal/app/api/activity/route.ts:12` is separate from `CLIENT_VISIBLE_ACTIVITY_TARGET_TYPES` (`lib/activity/types.ts:53`). | 03 updated: add `MONTHLY_CLOSE` to `VALID_TARGET_TYPES` so admins can filter by it; the role gate already excludes CLIENT users. |
| I2 | Info | `fetchNet30Billing` lacks the `eq(projects.type, 'CLIENT')` and role filters its sibling queries have. Pre-existing; 02 preserves behavior exactly. | No change (out of scope). Flagged for a future cleanup pass. |
| I3 | Info | Partial `uniqueIndex` and `jsonb` schema patterns verified against existing usage (`schema.ts:671`, 10 jsonb columns). | Patterns confirmed; no change. |
| I4 | Info | CLIENT-role users can create time logs in the internal app (`lib/queries/time-logs/mutations.ts` permits own-user logs), so closed-month warnings would leak internal-ops language ("drift", "Monthly Close Report") to client users. | **Owner decision: warnings are admin-only.** Route handlers compute `warning` only for ADMIN users; client users' late logs are still caught by the drift banner. Hour-block actions are already admin-only. |

## Product findings

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| PW1 | Warning | Prepaid across the book makes "how many hours do I have left?" every client's first question — no block-balance view exists in the client portal or future scope. | **Owner decision:** recorded in 06-future-scope as (half of) the **recommended next PRD**. |
| PW2 | Warning | Under prepaid, block depletion becomes the operational heartbeat (sell the next block before work stalls) — no depletion signal exists. | **Owner decision:** paired with PW1 as the recommended next PRD (both share the purchased-minus-logged balance computation). Commission history moves to third. |
| PW3 | Warning | "Report basis switches from" radio label is implementer jargon. | 01 updated: label is "**New billing starts:** This month / Next month" (default Next month), with hint text carrying the report-basis consequence. |
| PI1 | Info | Deferred priorities otherwise sound (roll-forward correctly waits for a real already-paid straggler). | No change. |
| PI2 | Info | Close flow, drift banner, and quiet closed-notice states fit the solo-admin "close right before invoicing" workflow; no daily-use friction found. | No change. |
