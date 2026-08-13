# 05 — Lead Origination Model

**PRD:** [005](README.md) · **Complexity:** High · **Schema:** Yes (destructive) · **App:** `apps/internal`
**Depends on:** Nothing · **Blocks:** Nothing
**Decisions:** [D13, D14, D15, D16](README.md#key-decisions)

> **This section destroys data.** `leads.source_detail` is dropped with no preservation column
> (D15). The pre-flight audit below is the only opportunity to review what will be lost. Run it and
> read the output before generating the migration.

---

## Problem

Kris: *"Make referral source info on leads into a contacts dropdown so it carries over to the project
when created. Maybe source needs to be rethought altogether since it's not really being used outside
of people?"*

Four separate defects sit behind that sentence.

### 1. Source is free text, so nothing can carry over

`leads.source_detail` is `text` with no FK. The placeholder in
`lead-sheet-form-fields.tsx:220` — *"Referral name, site URL, or event title"* — is three different
data types in one column. A referrer's name typed as text cannot be linked to anything.

### 2. The client side already has the right model, and the lead side doesn't match it

Jason, Phase 1: *"i just realized that the client has a toggle that lets you select internal partner
or external contact as the origination."*

`clients` has `origination_contact_id`, `origination_user_id`, and `closer_user_id`, guarded by
`clients_origination_mutex` (`packages/db/src/schema.ts:163-227`):

```sql
NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL)
```

`ClientOriginationPicker` implements the toggle with `OriginationMode = 'internal' | 'external'`
(`apps/internal/lib/settings/clients/use-client-sheet-state/types.ts:37`). Leads have none of it.

### 3. Conversion drops attribution on the floor

`apps/internal/lib/leads/actions/convert-lead.ts` calls `createClient` with
`originationContactId: null, originationUserId: null, closerUserId: null` — hardcoded. Every
converted client starts with no attribution, and the monthly-close origination and partner-payout
reports (`apps/internal/app/(dashboard)/reports/monthly-close/_components/`) read exactly these
fields.

### 4. Two of three enum values are dead

`leadSourceType` is `REFERRAL | WEBSITE | EVENT`.

- **`WEBSITE` has had no producer since the marketing cutover.**
  `docs/integrations/marketing-form-submissions.md:22`: *"The `leads-intake` POST is removed from
  both marketing actions."* Submissions now land in `form_submissions`, and promote-submission→lead
  sits in PRD 001 future scope, **declined by Kris**. Every lead today is hand-created.
- **`EVENT` is annotated "Reserved: for future event-based lead capture"** (`schema.ts:71`) and has
  never been used.

Which leaves `REFERRAL` — a person. Kris's read was right: *"it's not really being used outside of
people."*

### 5. A live write path bypasses all of it

`/api/integrations/leads-intake` still accepts token-authed POSTs and inserts directly into `leads`,
setting `sourceType: 'WEBSITE'` (`route.ts:17`). No known caller, and it would write enum values
this section removes.

Note also that **CLAUDE.md still documents this route as the active intake path** — stale
documentation that must be corrected here.

## Fix

Replace source with an origination model mirroring `clients` exactly (**D13**), populate the
client's origination *and* closer on conversion (**D16**), and remove the dead route (**D14**).

Mirroring rather than inventing means conversion is a field copy, not a translation layer. Two
half-matching models with a mapping function between them is how this kind of feature rots.

---

## Pre-flight audit — run this first

**Non-negotiable. Its output determines whether the migration is safe and what gets lost (D15).**

```sql
-- 1. Distribution of source values
SELECT source_type, count(*), count(source_detail) AS with_detail
FROM leads WHERE deleted_at IS NULL GROUP BY source_type;

-- 2. Every REFERRAL detail, and whether it resolves to a contact.
--    Rows with matched_contact_id IS NULL will be PERMANENTLY LOST (D15).
SELECT l.id, l.contact_name, l.source_detail, c.id AS matched_contact_id
FROM leads l
LEFT JOIN contacts c
  ON lower(trim(c.name)) = lower(trim(l.source_detail))
 AND c.deleted_at IS NULL
WHERE l.source_type = 'REFERRAL'
  AND l.source_detail IS NOT NULL
  AND l.deleted_at IS NULL
ORDER BY matched_contact_id NULLS FIRST;

-- 3. Confirm WEBSITE/EVENT carry nothing worth keeping
SELECT source_type, source_detail, count(*)
FROM leads WHERE source_type IN ('WEBSITE','EVENT') AND deleted_at IS NULL
GROUP BY 1, 2;
```

**Paste the results into [PROGRESS.md](PROGRESS.md) and get Jason's sign-off on the unmatched
rows before proceeding.** Query 2's `NULLS FIRST` ordering puts the about-to-be-deleted values at
the top on purpose.

If the unmatched set is large or valuable, the right response is to create the missing contacts
first and re-run — not to quietly widen the match or add back a preservation column that D15
removed.

---

## Schema

### New columns on `leads`

Mirroring `clients` (`schema.ts:163-171`), with the same comment style:

```ts
// Exactly one of these may be set at a time, per the leads_origination_mutex
// CHECK below. Internal sourcing partners use originationUserId; external
// referrers use originationContactId. Both NULL means no known origination.
// Mirrors clients.origination_* so conversion is a field copy — see PRD 005 D13.
originationContactId: uuid('origination_contact_id'),
originationUserId: uuid('origination_user_id'),
```

### Constraint and indexes

```ts
check(
  'leads_origination_mutex',
  sql`NOT (origination_user_id IS NOT NULL AND origination_contact_id IS NOT NULL)`
),
index('idx_leads_origination_contact_id')
  .using('btree', table.originationContactId.asc().nullsLast().op('uuid_ops'))
  .where(sql`(deleted_at IS NULL AND origination_contact_id IS NOT NULL)`),
index('idx_leads_origination_user_id')
  .using('btree', table.originationUserId.asc().nullsLast().op('uuid_ops'))
  .where(sql`(deleted_at IS NULL AND origination_user_id IS NOT NULL)`),
foreignKey({
  columns: [table.originationContactId],
  foreignColumns: [contacts.id],
  name: 'leads_origination_contact_id_fkey',
}).onDelete('set null'),
foreignKey({
  columns: [table.originationUserId],
  foreignColumns: [users.id],
  name: 'leads_origination_user_id_fkey',
}).onDelete('set null'),
```

`SET NULL` on both: losing the referrer link should not delete the lead. Matches the `clients`
FK behavior.

> **The inline `contacts` FK works here — do not copy the clients workaround (I4).**
> `schema.ts:223` notes that `clients.origination_contact_id`'s FK had to be added in a migration
> "to avoid forward reference (contacts table defined later)." That applies to `clients` (~line 155),
> which precedes `contacts` (line 233). `leads` is at line 931, **after** `contacts`, so the inline
> `foreignKey({ foreignColumns: [contacts.id] })` above is valid as written.

### Reviving `contact_leads`

The table is fully built and entirely unused — only two type exports in
`apps/internal/lib/types/client-contacts.ts:12-13` reference it. It has
`unique('contact_leads_contact_lead_key')` and both directional indexes already.

Insert a `contact_leads` row whenever a lead's `origination_contact_id` is set, so a contact's
detail page can answer "which leads did this person refer?" `originationContactId` remains the
authoritative single referrer; `contact_leads` is the queryable link table.

> **`contact_leads` has no `deletedAt` (W14 — audit finding).** Its columns are
> `id, contact_id, lead_id, created_at` (`schema.ts:315-342`). Clearing or changing a lead's
> referrer therefore performs a **hard `DELETE`**, which is correct here: `contact_clients` is
> built identically, so hard-delete is the established convention for pure link tables in this
> codebase. **Do not add `deletedAt` to it** — and note that TEST-PLAN X11 ("no hard deletes
> introduced") carries an explicit carve-out for exactly this case.

### Drops

In a **separate, second** migration generated after the backfill has been applied and verified —
never in the same file as the additive work (W9):

```sql
ALTER TABLE leads DROP COLUMN source_type;
ALTER TABLE leads DROP COLUMN source_detail;
DROP TYPE lead_source_type;
```

Plus `last_contact_at` and `awaiting_reply` if §03 hasn't already dropped them — coordinate so
neither migration double-drops, and record which one carried it in [PROGRESS.md](PROGRESS.md).

### Migration procedure

The generator produces add-and-drop but **cannot write the backfill**. Sequence:

1. Edit `packages/db/src/schema.ts`: add the origination columns, constraint, indexes, FKs. Leave
   `source_type` / `source_detail` in place.
2. `npm run db:generate -- --name lead_origination` → **additive migration only**.
3. **Hand-append the backfill SQL** to that generated file, before any drop. This is the one
   sanctioned hand-edit: Drizzle cannot express a data backfill, and the project rule against
   hand-editing migrations is about not desynchronizing schema from `meta/_journal.json` — appending
   `UPDATE`/`INSERT` statements doesn't.
4. Remove `source_type` / `source_detail` from `schema.ts`, delete the `leadSourceType` enum.
5. `npm run db:generate -- --name drop_lead_source` → the destructive migration, kept separate so it
   can be reviewed and deployed independently.
6. Review both. Apply with `npm run db:migrate`.

**Backfill:**

```sql
-- Link REFERRAL leads to a contact by exact case-insensitive name match.
UPDATE leads l
SET origination_contact_id = c.id
FROM contacts c
WHERE l.source_type = 'REFERRAL'
  AND l.source_detail IS NOT NULL
  AND l.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND lower(trim(c.name)) = lower(trim(l.source_detail));

-- Mirror into the link table.
INSERT INTO contact_leads (contact_id, lead_id)
SELECT origination_contact_id, id FROM leads
WHERE origination_contact_id IS NOT NULL
ON CONFLICT ON CONSTRAINT contact_leads_contact_lead_key DO NOTHING;

-- Everything else (unmatched REFERRAL detail, all WEBSITE, all EVENT) is
-- discarded by the DROP in the next migration. Per PRD 005 D15 this is
-- intentional and was reviewed in the pre-flight audit.
```

Exact match only — no fuzzy matching. A wrong referrer attribution is worse than none, because it
flows into the client's origination and then into partner payouts.

---

## Application changes

### Constants

In `apps/internal/lib/leads/constants.ts`, delete `LEAD_SOURCE_TYPES`, `LeadSourceTypeValue`,
`LEAD_SOURCE_LABELS`, and `getLeadSourceLabel` (lines 88-104), plus the `leadSourceType` import.

### Types

`apps/internal/lib/leads/types.ts` — `LeadRecord` drops `sourceType` / `sourceDetail` and gains:

```ts
originationMode: OriginationMode | null   // reuse the clients type
originationContactId: string | null
originationContactName: string | null
originationUserId: string | null
originationUserName: string | null
```

**Import `OriginationMode` from the clients module rather than redeclaring it.** A second identical
union is how the two models drift apart.

**`apps/internal/lib/types.ts:182` also declares a snake_case `DbLead` twin** carrying `source_type`
and `source_detail`. This is confirmed present, not hypothetical. The codebase maintains these
manual mirrors (`DbClient`, `DbProject`, `DbUser`) by hand, and they must change in lockstep or type
errors surface downstream in row mappers and sheet state.

### UI

Replace the two-field Source / Source Info block in
`apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-sheet-form-fields.tsx:171-227`
with an origination picker.

**Extract and reuse, don't duplicate.** `ClientOriginationPicker`
(`apps/internal/app/(dashboard)/clients/_components/client-sheet/client-origination-picker.tsx`) is
already a pure presentational component — every piece of state arrives as a prop
(`mode`, `selectedUser`, `selectedContact`, `availableUsers`, `availableContacts`, the handlers).
It has no client-specific logic in its body.

Move it to a shared location (`apps/internal/components/origination/origination-picker.tsx`) and
have both sheets render it. If a prop name genuinely doesn't generalize, rename it in the shared
component and update the one client call site — that's cheaper than maintaining two pickers that
must stay visually identical.

### Where the picker's options come from (C12 — audit finding)

**The lead sheet has no contacts today, on any path.** `SheetInitPayloads['lead']` is
`{lead, assignees, senderName}` (`payloads.ts:63-67`), `resolveLeadInit` returns exactly that
(`resolvers.ts:216-226`), and the canonical `/leads` page passes only `assignees`
(`leads-workspace.tsx:166`). Pointing at `/api/contacts` is not wiring — the picker cannot render
without a specified source.

**Mirror the client sheet's self-fetch.** `ClientOriginationPicker`'s options come from a `useEffect`
in `use-client-sheet-state/form-state.ts:225-300` that fetches contacts and admin users when the
props are absent — and a repo-wide grep for `allContacts=` returns **zero** call sites, so that fetch
is the only path in production. Extract it alongside the picker (C9) so both sheets share one
loader, rather than extending the sheet-init payload and the `/leads` page props for one field.

Rationale: the sheet-init route already serves every dashboard page, and adding a full contacts list
to it would grow the payload for every task/client/project sheet that never needs it.

### Option type reconciliation (C13 — audit finding)

The shared picker types `availableUsers` as `PartnerUserOption` — but the lead sheet holds
`LeadAssigneeOption`. **These are different shapes and will not typecheck:**

| Type | Shape | Source |
| --- | --- | --- |
| `PartnerUserOption` | `{ id, fullName, email }` | `use-client-sheet-state/types.ts:31-34` |
| `LeadAssigneeOption` | `{ id, name, email, avatarUrl }` | `apps/internal/lib/leads/types.ts` |

Move `PartnerUserOption` and `OriginationContactOption` next to the extracted picker
(`apps/internal/components/origination/types.ts`) and have the shared loader produce them for both
sheets. **Do not** map `LeadAssigneeOption → PartnerUserOption` at the lead call site — that is
exactly the translation layer C8 exists to prevent.

**Three more lead files import symbols this section deletes.** Missing any of them is a build
failure, not a cosmetic gap:

| File | What breaks | Fix |
| --- | --- | --- |
| `apps/internal/app/(dashboard)/leads/_components/lead-sheet/types.ts:24-25` | Zod schema uses `z.enum(LEAD_SOURCE_TYPES)` | Replace with the origination fields |
| `apps/internal/lib/leads/use-lead-sheet-state.ts:62-63, 82-87` | Form defaults plus a watcher that clears `sourceDetail` when `sourceType` changes | Replace with mode/field state; the watcher becomes the mutex clear |
| `apps/internal/app/(dashboard)/leads/_components/lead-card.tsx:23, 135-147` | Imports `getLeadSourceLabel`; renders the source badge | Origination badge — see below |

### Lead card badge (D17)

`lead-card.tsx` currently builds an outline `Badge` from the source label with `sourceDetail` shown
on hover (`showSourceTooltip`). **Keep that exact shape** — same slot, same
`text-muted-foreground text-[10px] font-medium tracking-wide uppercase` styling, same tooltip
behavior — and swap the content:

- **Label:** the origination kind — `Referral` for an external contact, `Partner` for an internal
  user. Nothing rendered when neither is set, matching today's null handling.
- **Hover:** the person's name (`originationContactName` or `originationUserName`).

This is a like-for-like swap, so board card density is unchanged. **Last-touch is deliberately not
added to the card** (D17) — the badge is a display over `LeadRecord`'s origination fields and must
not grow its own resolution logic (W11).

### Save action

`apps/internal/app/(dashboard)/leads/_actions/save-lead.ts`:

- Zod schema drops `sourceType` / `sourceDetail`, gains `originationMode`, `originationContactId`,
  `originationUserId`.
- **Enforce the mutex in the action**, not only in the database — clear the opposite field whenever
  a mode is selected, so a constraint violation is never the user-facing error.
- Maintain the `contact_leads` row: insert on set, delete on clear or change.

### Activity events

`leadCreatedEvent` takes `sourceType?: string | null`
(`apps/internal/lib/activity/events/leads.ts:5-19`). Replace with origination metadata. Historical
`activity_logs` rows keep their old JSONB metadata — that's an immutable audit trail and is correct.
Do **not** migrate historical activity metadata.

### Conversion (D16)

In `apps/internal/lib/leads/actions/convert-lead.ts`, replace the three hardcoded nulls:

```ts
const clientResult = await createClient(
  { user },
  {
    // ...
    originationContactId: lead.originationContactId,
    originationUserId: lead.originationUserId,
    // D16: the person working the lead is the person who closed it.
    closerUserId: lead.assigneeId,
  }
)
```

Three things to handle:

1. **`existingClientId` path.** When converting onto an *existing* client
   (`convert-lead.ts:60-73`), that client may already have origination or a closer set.
   **Do not overwrite existing non-null values** — the existing client's attribution is
   authoritative and may already have fed a closed month. Fill only what is null, and add a warning
   to the returned `warnings[]` array when a value was skipped. That array already exists and is
   surfaced by the conversion dialog.
2. **Mutex safety.** The lead's own mutex guarantees at most one origination field is set, so the
   copy cannot violate `clients_origination_mutex`. Preserved only because the models mirror each
   other — a reason not to let them drift.
3. **Closer may be null.** An unassigned lead yields `closerUserId: null`, which is the current
   behavior. No warning needed.
4. **An archived assignee will abort the entire conversion (W12 — audit finding).** `createClient`
   calls `assertClientPartnerUserRoles({ originationUserId, closerUserId })`
   (`create-client.ts:55-61`), which returns an error — killing the whole conversion — when the user
   has `deleted_at IS NOT NULL` (*"Selected partner user is archived"*) or a non-ADMIN role.

   Role is safe: `fetchLeadAssignees()` delegates to `fetchAdminUsers()`, so every lead assignee is
   an ADMIN. **Archival is not safe.** Converting an older lead whose assignee has since been
   archived would fail with an error about a field the user never touched.

   **Guard before copying:**

   ```ts
   // D16 + W12: only copy the assignee as closer if they're still a valid
   // partner user. An archived assignee must not block the conversion.
   const closerUserId = await resolveCloserFromAssignee(lead.assigneeId)
   // → returns null (and pushes a warnings[] entry) when the assignee is
   //   archived or no longer ADMIN, rather than letting createClient abort.
   ```

   The same guard applies to `originationUserId` for an internal partner who was later archived.

### Removing the route (D14)

- Delete `apps/internal/app/api/integrations/leads-intake/` entirely.
- Remove `/api/integrations/leads-intake` from `apps/internal/proxy.ts:21`.
- Remove `LEADS_INTAKE_TOKEN` from `turbo.json:36` and from `apps/internal/.env.example`.
- **Fix `CLAUDE.md`** — delete the "Lead Intake Webhook" section, which documents this route as the
  live intake path with a payload shape and setup instructions. It is stale.
- **Leave `apps/internal/scripts/test-form-intake.ts` alone.** It was checked during PRD authoring:
  it targets `/api/integrations/audit-responses` and `/api/integrations/contact-submissions` (lines
  69, 73, 186, 198) — the *replacement* endpoints — and never touches `leads-intake`. Deleting it
  would remove working coverage for the intake path that is still live.
- Ask Jason to remove `LEADS_INTAKE_TOKEN` from Vercel project settings. **Do not do this yourself**
  — it's a production configuration change.

---

## Architecture notes

- **C8 — Mirror, don't map.** The whole justification for D13 is that lead and client origination
  have the *same shape*, making conversion a copy. Any lead-side-only field re-introduces a
  translation layer and the drift it brings.
- **C9 — Extracting the picker is the point, not a nicety.** Two visually identical pickers that
  must stay in sync is the same failure mode as §01's two `getOrCreateSalesProject` copies.
- **C10 — Never overwrite existing client attribution.** These fields feed monthly close. Memory
  note *"Billing terms + close locking"*: never let a mutable field silently change what a
  historical report reads.
- **W8 — Exact-match backfill only.** Fuzzy matching creates false attributions that flow into
  partner payouts.
- **W9 — Split the destructive migration.** Steps 2 and 5 produce separate files so the additive
  half can deploy and be verified before anything is dropped.
- **W10 — Historical activity metadata is immutable.** Old `sourceType` values in `activity_logs`
  JSONB stay. It's an audit trail.
- **W11 — The lead card badge is a display, not a second source of truth.** It reads the same
  `LeadRecord` origination fields the sheet does. No independent resolution logic, and it is not a
  reason to add last-touch to the card — D17 deliberately keeps it off.

---

## Acceptance criteria

**Pre-flight**
- [ ] All three audit queries run against production; results pasted into PROGRESS.md.
- [ ] Jason has explicitly signed off on the unmatched `source_detail` values being discarded (D15).

**Schema**
- [ ] `leads.origination_contact_id` and `leads.origination_user_id` added with FKs
      (`ON DELETE SET NULL`) and partial indexes.
- [ ] `leads_origination_mutex` CHECK added, matching `clients_origination_mutex`.
- [ ] Additive migration generated, backfill SQL hand-appended, reviewed.
- [ ] Backfill uses exact case-insensitive matching only — **no fuzzy matching**.
- [ ] `contact_leads` rows created for every backfilled origination contact.
- [ ] Separate destructive migration drops `source_type`, `source_detail`, and the
      `lead_source_type` enum.
- [ ] Column drops coordinated with §03 so `last_contact_at` / `awaiting_reply` aren't double-dropped.
- [ ] No RLS statements in either migration.

**Application**
- [ ] `LEAD_SOURCE_TYPES`, `LEAD_SOURCE_LABELS`, `LeadSourceTypeValue`, `getLeadSourceLabel` all
      removed from `constants.ts`.
- [ ] `LeadRecord` drops source fields, gains origination fields, and **imports `OriginationMode`
      from the clients module** rather than redeclaring it.
- [ ] `DbLead` at `apps/internal/lib/types.ts:182` updated in lockstep — `source_type` and
      `source_detail` removed, origination fields added.
- [ ] `ClientOriginationPicker` extracted to a shared component and rendered by **both** the client
      sheet and the lead sheet.
- [ ] **The picker's option loader is extracted with it** (C12) — the lead sheet resolves contacts
      and admin users through the shared self-fetch, not through a widened sheet-init payload.
- [ ] **`PartnerUserOption` / `OriginationContactOption` moved beside the shared picker** (C13); no
      `LeadAssigneeOption → PartnerUserOption` mapping at the lead call site.
- [ ] `contact_leads` clearing is a **hard delete**; no `deletedAt` added to it (W14).
- [ ] `lead-card.tsx`, `use-lead-sheet-state.ts`, and `lead-sheet/types.ts` all migrated off the
      deleted source symbols — **the build fails if any is missed.**
- [ ] Lead card renders the origination badge per D17: kind as label, name on hover, nothing when
      unset, same slot and styling as the old source badge.
- [ ] Verification grep — **scoped to leads**, because `form_submissions` has its own unrelated
      `sourceDetail` field and an unscoped grep always returns hits:
      `grep -rn "sourceType\|sourceDetail" apps/internal/lib/leads apps/internal/app/\(dashboard\)/leads packages/db --include="*.ts" --include="*.tsx"`
      returns nothing.
- [ ] **Not touched by this section** (different concept — form submission source, not lead source):
      `lib/form-submissions/contact-payload.ts`, `lib/form-submissions/audit-payload.ts`,
      `lib/queries/form-submissions.ts`, `submissions/_components/submission-detail-sheet.tsx`,
      `scripts/test-form-intake.ts`.
- [ ] `save-lead.ts` enforces the mutex in the action; selecting one mode clears the other field.
- [ ] `contact_leads` row is created on set and removed on clear/change.

**Conversion**
- [ ] Converting a lead with an external referrer sets `clients.origination_contact_id`.
- [ ] Converting a lead with an internal partner sets `clients.origination_user_id`.
- [ ] `clients.closer_user_id` is set from the lead's assignee (D16).
- [ ] Converting onto an **existing** client does **not** overwrite non-null origination or closer
      values, and adds a warning to `warnings[]` when a value was skipped.
- [ ] Converting an unassigned lead leaves `closer_user_id` null without error.
- [ ] **Converting a lead whose assignee has been archived succeeds**, sets `closer_user_id` to
      null, and adds a `warnings[]` entry — it does **not** abort with "Selected partner user is
      archived" (W12).
- [ ] Same guard holds for an internal-partner origination user who was later archived.
- [ ] Monthly-close origination and partner-payout reports render correctly for a newly converted
      client.

**Route removal**
- [ ] `apps/internal/app/api/integrations/leads-intake/` deleted.
- [ ] Removed from `apps/internal/proxy.ts`.
- [ ] `LEADS_INTAKE_TOKEN` removed from `turbo.json` and `.env.example`.
- [ ] **CLAUDE.md "Lead Intake Webhook" section deleted.**
- [ ] `scripts/test-form-intake.ts` **left in place** — it targets `audit-responses` /
      `contact-submissions`, not the removed route.
- [ ] Jason notified to remove `LEADS_INTAKE_TOKEN` from Vercel (not done by the implementer).
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root.

---

## Files

**Created**
- `apps/internal/components/origination/origination-picker.tsx` *(extracted)*
- `packages/db/drizzle/migrations/00XX_lead_origination.sql` *(generated + hand-appended backfill)*
- `packages/db/drizzle/migrations/00XX_drop_lead_source.sql` *(generated)*

**Modified**
- `packages/db/src/schema.ts` — columns, CHECK, indexes, FKs; then drops
- `packages/db/src/relations.ts` — lead↔contact, lead↔user origination relations
- `apps/internal/lib/leads/constants.ts` · `types.ts` · `apps/internal/lib/types.ts`
- `apps/internal/lib/data/leads/index.ts` — select and map origination
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/lead-sheet-form-fields.tsx`
- `apps/internal/app/(dashboard)/leads/_components/lead-sheet/types.ts` — Zod schema
- `apps/internal/lib/leads/use-lead-sheet-state.ts` — form defaults + mutex watcher
- `apps/internal/app/(dashboard)/leads/_components/lead-card.tsx` — origination badge (D17)
- `apps/internal/app/(dashboard)/leads/_actions/save-lead.ts`
- `apps/internal/lib/leads/actions/convert-lead.ts`
- `apps/internal/lib/activity/events/leads.ts`
- `apps/internal/app/(dashboard)/clients/_components/client-sheet/client-sheet-form.tsx` — use shared picker
- `apps/internal/proxy.ts` · `turbo.json` · `apps/internal/.env.example` · `CLAUDE.md`

**Deleted**
- `apps/internal/app/api/integrations/leads-intake/route.ts`
- `apps/internal/app/(dashboard)/clients/_components/client-sheet/client-origination-picker.tsx` *(moved)*

**Must NOT be deleted**
- `apps/internal/scripts/test-form-intake.ts` — targets the replacement intake endpoints, not
  `leads-intake`
