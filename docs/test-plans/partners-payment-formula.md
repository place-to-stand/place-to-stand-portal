# Test Plan: Partners Payment Formula

## Overview

Validates the new four-way split of billable hours ($200/hr → $90 payroll + $40 closer + $20 origination + $50 house, effective **2026-04-01**). Covers schema migration, the new origination/closer fields on clients, the rewritten monthly close report, and regression of existing functionality.

## Prerequisites

**Environment**
- Local dev server running: internal app at http://localhost:3000, client portal at http://localhost:3001
- Database: local copy of production data + migration `0050_partners_payment_formula` applied

**Test accounts** (all with password `password123`)
- `jason@placetostandagency.com` — ADMIN
- `damon@placetostandagency.com` — ADMIN
- `kris@placetostandagency.com` — ADMIN

**Test data already in local DB** (from prod clone)
- 17 clients (4 with legacy `origination_contact_id` preserved from pre-migration `referred_by`)
- 34 projects, 312 tasks, 182 time logs, 33 hour blocks, 37 leads, 37 contacts, 3 admin users

**Note**: The 4 legacy referrers are all external contacts. No client currently has an `origination_user_id` or `closer_user_id` set — those are new and empty.

---

## Test Cases

### Section A — Client Sheet Form (Origination + Closer)

#### TC-A01: Add new client with internal origination
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Preconditions:** Signed in as jason. On `/clients`.

**Steps:**
1. Click "Add client"
2. Enter name "Test Internal Origin Co"
3. Select billing type "Prepaid"
4. In the **Origination** section, the segmented control should default to **Internal partner**
5. Click "Select internal partner" → pick `damon@placetostandagency.com`
6. Save

**Expected Result:**
- Client saves without error
- Toast: "Client created"
- Navigating back to `/clients`, the new client's Origination column shows a green checkmark with hover tooltip "Internal — Damon [...]"
- Opening the client sheet in edit mode shows the Internal partner tab pre-selected with Damon populated

---

#### TC-A02: Add new client with external origination
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Click "Add client"
2. Enter name "Test External Origin Co"
3. Click the **External referrer** tab (new clients default to Internal)
4. Click "Select external referrer" → pick any contact from the list
5. Save

**Expected Result:**
- Client saves
- Opening in edit mode: External tab pre-selected with the contact populated
- `/clients` landing shows green checkmark, tooltip "External — [Contact Name]"

---

#### TC-A03: Origination mutex — switching tabs clears opposite side
**Priority:** P0 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Add new client "Mutex Test"
2. Click Internal partner tab → pick an admin user (Kris)
3. Without saving, click External referrer tab → verify Kris selection is gone, picker shows "Select external referrer"
4. Pick a contact
5. Click Internal partner tab again → verify the contact is cleared
6. Leave both empty, save

**Expected Result:**
- Each tab switch clears the non-active selection
- Client saves with both origination fields NULL
- `/clients` shows "—" in Origination column for this client

---

#### TC-A04: Closer picker — select, clear, save
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Edit "Test Internal Origin Co" (from TC-A01)
2. Scroll to **Closer (optional)** section
3. Click "Select closer" → pick `kris@placetostandagency.com`
4. Save
5. Re-open the sheet, verify Kris is still populated
6. Re-open, click the X on the closer chip to clear
7. Save

**Expected Result:**
- First save: activity feed entry says "Updated client (closer)"
- Second save: activity feed entry says "Updated client (closer)" with closer going back to null
- Client detail page shows/hides the Closer row accordingly

---

#### TC-A05: Unsaved-changes warning triggers on origination/closer changes
**Priority:** P1 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Open any client sheet (edit mode)
2. Don't touch the name field
3. Switch origination mode from External → Internal → pick a user
4. Click outside the sheet (or press Escape)

**Expected Result:**
- Unsaved-changes dialog appears
- Cancel button returns to sheet with selection intact
- Discard button closes sheet without saving

---

#### TC-A06: Non-admin users not selectable in origination/closer
**Priority:** P1 | **Type:** Security | **Role:** ADMIN

**Steps:**
1. Seed a CLIENT-role user in local DB (or use one that already exists from prod clone)
2. Open a client sheet, go to Internal partner tab → open picker
3. Verify the CLIENT-role user does NOT appear in the dropdown
4. Repeat for Closer picker

**Expected Result:**
- Only ADMIN users appear in both pickers
- If one somehow slipped through, the server would reject via `assertClientPartnerUserRoles` with the message "Only PTS admin users can be set as origination or closer."

---

### Section B — Client Listing + Detail Page

#### TC-B01: Clients landing Origination column
**Priority:** P0 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Navigate to `/clients`

**Expected Result:**
- Rightmost column header reads "Origination" (not "Referral")
- The 4 legacy clients show a green checkmark; hovering shows tooltip "External — [contact name]"
- Clients with no origination show "—"
- Any client you assigned in Section A reflects its assignment

---

#### TC-B02: Client detail widget — legacy external referrer
**Priority:** P0 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Pick a legacy client (one of the 4 that had `referred_by`)
2. Click into `/clients/[slug]`
3. Inspect the Details widget on the left

**Expected Result:**
- Row labeled "Origination" with the contact name + subtitle "(External referrer)" in muted text
- No Closer row (none assigned)

---

#### TC-B03: Client detail widget — internal + closer both set
**Priority:** P0 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. From TC-A01's test client (internal origination + closer from TC-A04)
2. Navigate to its detail page

**Expected Result:**
- "Origination" row shows the admin name + subtitle "(Internal partner)"
- "Closer" row shows Kris

---

#### TC-B04: Client detail widget — nothing set
**Priority:** P2 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Find a client with neither origination nor closer
2. Visit its detail page

**Expected Result:**
- Neither the Origination row nor the Closer row is rendered (conditional)

---

### Section C — Monthly Close Report

#### TC-C01: Summary cards — all 8 present and correct
**Priority:** P0 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Navigate to `/reports/monthly-close`
2. Observe the summary cards area

**Expected Result:**
- **Top row (3 cards)**: Billing In, Total Payouts, House
- **Bottom row (5 cards)**: Prepaid Billing, Net 30 Billing, Payroll (subtitle "45%"), Origination (subtitle "Finder (10%)"), Closer (subtitle "Deal closer (20%)")
- "Total Payouts" should equal Payroll + Origination + Closer
- "Billing In" should equal Prepaid + Net 30

---

#### TC-C02: Rate cutover — March 2026 (pre-cutover)
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. On `/reports/monthly-close`, navigate to **March 2026**
2. Check the Payroll section description
3. Check the Origination section — inspect the rows
4. Confirm the Closer section is NOT rendered anywhere on the page

**Expected Result:**
- Payroll section says `at $100/hour`
- Origination section is present and says `at $20/hour`, but only shows rows where the originator is an **external contact**. Internal-user originators are filtered out (pre-cutover only external referrers were paid)
- **Closer section is completely hidden** from the right column because the closer rate is $0 pre-cutover
- **Closer bucket is hidden** from the Total Payouts rollup card for the same reason
- **Closer column is hidden** from the Partner Payouts table at the bottom
- The residual House absorbs both the un-paid internal origination AND any unassigned closer commission

---

#### TC-C03: Rate cutover — April 2026 (post-cutover)
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Navigate to **April 2026**
2. Check each section's rate label and visibility

**Expected Result:**
- Payroll section says `at $90/hour`
- Origination section says `at $20/hour` and shows **both internal (user) and external (contact)** originators
- Closer section is **visible** in the right column, says `at $40/hour`
- Total Payouts rollup card shows three child cells: Payroll · 45%, Origination · 10%, Closer · 20%
- Partner Payouts table at the bottom includes the Closer column
- House card shows the residual: `Work Billable − Payroll − Origination − Closer`

---

#### TC-C04: Origination section — prepaid activity
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Setup:** Assign an internal origination to a **prepaid** client, then create a new hour block on that client this month.

**Steps:**
1. Navigate to `/reports/monthly-close` for the current month
2. Scroll to the Origination Commissions section

**Expected Result:**
- A row appears with the originator's name + "Internal" badge
- Hours column shows the hour block's `hours_purchased`
- Commission column shows `hours × $20`
- Table footer totals reflect the new row

---

#### TC-C05: Origination section — net_30 activity
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Setup:** Assign an external origination contact to a **net_30** client, then log time against that client's project in the current month.

**Steps:**
1. Navigate to `/reports/monthly-close` current month
2. Observe Origination section

**Expected Result:**
- External referrer row appears with "External" badge
- Hours = hours logged in time_logs
- Commission = `hours × $20`

---

#### TC-C06: Origination section — mixed billing types per originator
**Priority:** P1 | **Type:** Functional | **Role:** ADMIN

**Setup:** One originator tied to BOTH a prepaid client (with a new hour block) AND a net_30 client (with logged hours) in the same month.

**Steps:**
1. Open monthly close for that month
2. Find the originator's row

**Expected Result:**
- **One row** for that originator (merged across billing types, keyed on `${kind}:${id}`)
- Clients column comma-separates both client names
- Hours = sum of prepaid purchased + net_30 logged
- Commission = total hours × $20

---

#### TC-C07: Closer section — populated correctly
**Priority:** P0 | **Type:** Functional | **Role:** ADMIN

**Setup:** Same as TC-C04/TC-C05 but with a closer assigned instead of (or in addition to) origination.

**Expected Result:**
- Closer table shows one row per closer user with Clients, Hours, Commission columns
- Commission = `hours × $40` for April 2026+
- For March 2026, even with a closer assigned, the table is empty (`$0/hr`)

---

#### TC-C08: Math reconciliation — Billing In = Total Payouts + House
**Priority:** P1 | **Type:** Functional | **Role:** ADMIN

**Background:** Origination and Closer are computed on a **billing basis** (prepaid `hour_blocks.hours_purchased` + net_30 `time_logs.hours` on net_30 client projects). Payroll stays on a **work basis** (admin time logs on CLIENT projects at the payroll rate). The reconciliation on this page is the cash-flow one:

    Billing In = Payroll + Origination + Closer + House

House is computed as the residual `Billing In − Total Payouts`, so the identity holds by construction.

**Work Billable** is a separate, informational metric showing the accrual value of work done this month. It can diverge from Billing In — when admins work down prepaid hours purchased in prior months, Work Billable will exceed Billing In, and House may even go negative. That's legitimate cash-vs-accrual signal.

**Steps:**
1. Navigate to `/reports/monthly-close` for any month with activity
2. Sum `Payroll + Origination + Closer + House` from the cards

**Expected Result:**
- Sum exactly equals the **Billing In** card
- Work Billable can be higher or lower than Billing In — that's OK; it's a separate view
- House can be negative in months with high accrued work but low new billing

**Concrete example — March 2026 on the current local DB clone (pre-cutover rates, external-only origination):**
- Prepaid billing = 75 hrs × $200 = **$15,000**
- Net 30 billing = 46 hrs × $200 = **$9,200**
- **Billing In = $24,200**
- Payroll = 126.75 × $100 = **$12,675**
- Origination = 25 prepaid hrs × $20 = **$500** (external contacts only pre-cutover; internal-user originators are dropped per the `internalOriginationPayable: false` flag)
- Closer = $0 (pre-cutover closer rate)
- **Total Payouts = $13,175**
- **House (residual) = $24,200 − $13,175 = $11,025**
- Sum check: $12,675 + $500 + $0 + $11,025 = $24,200 ✓
- Work Billable (informational) = 126.75 × $200 = **$25,350** (exceeds Billing In by $1,150 — that's 5.75 hrs of prepaid time worked down from prior-month purchases)

---

#### TC-C09: Empty state copy
**Priority:** P2 | **Type:** UI | **Role:** ADMIN

**Steps:**
1. Navigate to a month far in the past with no activity (or a future month)

**Expected Result:**
- Origination section: "No origination activity this month."
- Closer section: "No closer activity this month."
- Payroll, Net 30, Prepaid sections also show their empty state copy

---

#### TC-C10: Month boundary behavior
**Priority:** P1 | **Type:** Edge | **Role:** ADMIN

**Steps:**
1. Create or find a prepaid hour block with `created_at = 2026-03-31 23:59:00 UTC`
2. View March 2026 monthly close — verify it appears there
3. Switch to April 2026 — verify the same block does NOT appear
4. Ensure the hours in March render at the pre-cutover house rate ($80/hr)

**Expected Result:**
- Same hour block renders at old rates in March, disappears from April
- Opposite boundary: a block at `2026-04-01 00:01:00 UTC` appears only in April at new rates

---

### Section D — Server-Side Validation

#### TC-D01: Zod mutex refine rejects both origination sides
**Priority:** P0 | **Type:** Security | **Role:** ADMIN

**Setup:** Requires crafting a raw payload to bypass the UI mutex.

**Steps:**
1. Open DevTools → Network tab
2. Edit a client, set internal origination → save → capture the request
3. Replay the request with `originationContactId` ALSO populated (both set)

**Expected Result:**
- Server returns error: "Pick either an internal partner or an external referrer for origination, not both."
- No database write occurred

---

#### TC-D02: Database CHECK constraint rejects both
**Priority:** P1 | **Type:** Security | **Role:** N/A (DB-level)

**Steps:**
1. Run raw SQL on local DB:
   ```sql
   UPDATE clients
   SET origination_user_id = (SELECT id FROM users WHERE role='ADMIN' LIMIT 1),
       origination_contact_id = (SELECT id FROM contacts LIMIT 1)
   WHERE id = (SELECT id FROM clients LIMIT 1);
   ```

**Expected Result:**
- Postgres rejects with: `new row for relation "clients" violates check constraint "clients_origination_mutex"`

---

#### TC-D03: Non-admin user rejected for origination/closer
**Priority:** P0 | **Type:** Security | **Role:** ADMIN

**Setup:** Need a CLIENT-role user in local DB (check if any exist from prod, or seed one).

**Steps:**
1. Replay a client save request with `closerUserId` set to a CLIENT-role user's UUID

**Expected Result:**
- Server returns: "Only PTS admin users can be set as origination or closer."
- No write occurred

---

#### TC-D04: Archived user rejected
**Priority:** P2 | **Type:** Security | **Role:** ADMIN

**Setup:** Archive an admin user (`UPDATE users SET deleted_at = now() WHERE id = ...`)

**Steps:**
1. Attempt to save a client with that archived user as closer

**Expected Result:**
- Server returns: "Selected partner user is archived."

---

### Section E — Activity Log

#### TC-E01: Origination change logged
**Priority:** P1 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Edit a client, change origination (switch tabs + pick new user/contact)
2. Save
3. Navigate to `/clients/activity` (or the activity tab on the client)

**Expected Result:**
- New activity entry for the client update
- `changedFields` includes `"origination"` label

---

#### TC-E02: Closer change logged
**Priority:** P1 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Assign a closer to a client, save
2. Clear the closer, save
3. Check activity log

**Expected Result:**
- Two activity entries, each with `"closer"` in changedFields

---

#### TC-E03: Origination + closer + name change batched
**Priority:** P2 | **Type:** Functional | **Role:** ADMIN

**Steps:**
1. Edit a client, change: name, origination, closer in one save
2. Check activity log

**Expected Result:**
- Single activity entry with all three labels in changedFields: "name", "origination", "closer"

---

### Section F — Lead Conversion

#### TC-F01: Converted lead has null origination/closer
**Priority:** P1 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Go to `/leads`, find a lead with any source type
2. Convert it to a client
3. Inspect the resulting client (sheet or detail page)

**Expected Result:**
- New client has NO origination (neither user nor contact)
- NO closer assigned
- `/clients` shows "—" in the Origination column for this client
- Database: `origination_contact_id IS NULL AND origination_user_id IS NULL AND closer_user_id IS NULL`

---

### Section G — Regression

#### TC-G01: Existing payroll section still works
**Priority:** P0 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Navigate to `/reports/monthly-close` current month
2. Compare the Payroll section rows against production's known-good values (or a recent month with activity)

**Expected Result:**
- All admin users who logged time appear
- Hours and amounts look sensible ($90/hr post-cutover)
- Totals row matches sum of individual rows

---

#### TC-G02: Existing client sheet fields still save
**Priority:** P0 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Edit a client
2. Change name, notes, billing type, state, website
3. Don't touch origination/closer
4. Save

**Expected Result:**
- All non-origination fields save normally
- Origination/closer unchanged
- No new errors introduced

---

#### TC-G03: Contacts picker still works
**Priority:** P0 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Add/remove contacts from a client via the Contacts picker (NOT the origination picker)
2. Save

**Expected Result:**
- Contact links update correctly
- Origination contact (if any) is preserved independently

---

#### TC-G04: Archive client still works
**Priority:** P1 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Edit a client, click Archive
2. Confirm

**Expected Result:**
- Client soft-deleted, disappears from `/clients`, appears in `/clients/archive`
- Origination/closer fields preserved in the archived row

---

#### TC-G05: Clients landing table columns render
**Priority:** P1 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Load `/clients`
2. Verify all columns render: Client, Billing, Projects, Hours, Origination, Links

**Expected Result:**
- No layout break
- Hours column still shows remaining hours for prepaid clients
- Projects column shows active project count + "other"

---

#### TC-G06: Proposal / invoice flows unaffected
**Priority:** P1 | **Type:** Regression | **Role:** ADMIN

**Steps:**
1. Create a proposal
2. Send → convert to invoice
3. Generate hour blocks

**Expected Result:**
- No errors, the `DEFAULT_HOURLY_RATE=200` from `lib/proposals/constants.ts` still applies (rate schedule only affects partner splits, not billing rate)

---

### Section H — Access Control

#### TC-H01: Unauthenticated user redirected
**Priority:** P0 | **Type:** Security | **Role:** Unauthenticated

**Steps:**
1. Sign out
2. Visit http://localhost:3000/reports/monthly-close

**Expected Result:**
- Redirected to `/sign-in?redirect=/reports/monthly-close`

---

#### TC-H02: Monthly close requires ADMIN role
**Priority:** P0 | **Type:** Security | **Role:** CLIENT

**Steps:**
1. Sign in as a CLIENT-role user (if one exists) or change one of the admins to CLIENT temporarily
2. Navigate to `/reports/monthly-close`

**Expected Result:**
- Redirected to `/unauthorized` (because `page.tsx` calls `requireRole('ADMIN')`)

---

#### TC-H03: Client portal regression — still works
**Priority:** P1 | **Type:** Regression | **Role:** CLIENT

**Steps:**
1. Go to http://localhost:3001 and sign in as a client portal user
2. View projects, GitHub setup

**Expected Result:**
- No errors (this feature didn't touch the client portal)
- Nothing partner-payment-related is exposed to clients

---

### Section I — Accessibility

#### TC-I01: Keyboard navigation through origination picker
**Priority:** P2 | **Type:** A11y | **Role:** ADMIN

**Steps:**
1. Open a client sheet, Tab through fields until reaching the origination segmented control
2. Press Tab/Shift+Tab to move between Internal/External buttons
3. Press Enter/Space to activate a tab
4. Tab into the picker button, Enter to open
5. Arrow keys to navigate options, Enter to select

**Expected Result:**
- All controls reachable without mouse
- Focus visible at each step
- Selection announced to screen reader (if tested)

---

#### TC-I02: Closer picker keyboard flow
**Priority:** P2 | **Type:** A11y | **Role:** ADMIN

**Steps:** Same as above for the Closer picker.

**Expected Result:** Same — fully keyboard accessible.

---

### Section J — Responsive

#### TC-J01: Client sheet on mobile
**Priority:** P2 | **Type:** Responsive | **Role:** ADMIN

**Steps:**
1. Chrome DevTools → toggle device toolbar → 375×667
2. Open a client sheet

**Expected Result:**
- Segmented control wraps or fits without horizontal scroll
- Both pickers render within sheet bounds
- Save button stays accessible at the bottom

---

#### TC-J02: Monthly close on mobile
**Priority:** P2 | **Type:** Responsive | **Role:** ADMIN

**Steps:**
1. At 375×667, view `/reports/monthly-close`

**Expected Result:**
- Summary cards stack vertically (grid responds)
- Tables scroll horizontally within their container (not the whole page)
- No content clipped

---

### Section K — Cross-browser

#### TC-K01: Chrome smoke test
**Priority:** P0 | **Type:** Cross-browser

Walk through TC-A01, TC-B02, TC-C03 in Chrome.

#### TC-K02: Safari smoke test
**Priority:** P1 | **Type:** Cross-browser

Same walkthrough in Safari. Watch for date input differences and popover positioning.

#### TC-K03: Firefox smoke test
**Priority:** P2 | **Type:** Cross-browser

Same walkthrough in Firefox.

---

## Prioritized execution order

**P0 (must pass before merge)** — ~45 minutes
TC-A01, TC-A02, TC-A03, TC-A04, TC-B01, TC-B02, TC-B03, TC-C01, TC-C02, TC-C03, TC-C04, TC-C05, TC-C07, TC-D01, TC-D03, TC-G01, TC-G02, TC-G03, TC-H01, TC-H02, TC-K01

**P1 (important but not blocking)** — ~30 minutes
TC-A05, TC-A06, TC-C06, TC-C08, TC-C10, TC-D02, TC-E01, TC-E02, TC-F01, TC-G04, TC-G05, TC-G06, TC-H03, TC-K02

**P2 (nice to have)** — ~20 minutes
TC-B04, TC-C09, TC-D04, TC-E03, TC-I01, TC-I02, TC-J01, TC-J02, TC-K03

**Total estimated time**: ~95 minutes for full sweep. P0-only run is ~45 minutes and covers the critical paths.

---

## Test data setup helpers

If you need to seed specific scenarios for C04/C05/C06/C07, these SQL snippets run in the local DB (via `docker exec supabase_db_place-to-stand-portal psql -U postgres -d postgres -c "..."`) will help:

```sql
-- Pick IDs to use
SELECT id, name, billing_type FROM clients ORDER BY name LIMIT 5;
SELECT id, email, full_name FROM users WHERE role='ADMIN';

-- Assign an internal origination + closer to a specific client
UPDATE clients
SET origination_user_id = '<admin-uuid>',
    origination_contact_id = NULL,
    closer_user_id = '<admin-uuid>'
WHERE id = '<client-uuid>';

-- Create a synthetic hour block dated today (for current-month monthly close)
INSERT INTO hour_blocks (client_id, hours_purchased, created_at)
VALUES ('<client-uuid>', 10.00, now());

-- Create a synthetic time log (requires a project for that client and an admin user)
INSERT INTO time_logs (project_id, user_id, hours, logged_on)
VALUES ('<project-uuid>', '<admin-uuid>', 5.00, current_date);
```

## Automation candidates (future, not this PR)

Worth converting to automated tests once the feature is validated:
- **Unit**: `getPartnerRatesForPeriod` with dates across the cutover boundary
- **Unit**: the `toFiniteNumber` helper in `monthly-close.ts` assembler
- **Integration**: `assertClientPartnerUserRoles` against a test DB with mixed role users
- **E2E (Playwright)**: TC-A01, TC-A03 (mutex), TC-C01 (summary cards render)
- **DB-level**: TC-D02 (CHECK constraint behavior) — pure SQL test, no app dependency

## Known non-blockers

- **Storage images**: per the local-data clone choice, avatars/task attachments may show broken links because the storage buckets weren't cloned. Don't treat this as a test failure.
- **Pre-existing lint warning** in `apps/internal/app/(public)/share/invoices/[token]/public-invoice.tsx:140` (unrelated to this feature) — unchanged, not a regression.
- **CHECK constraints are `NOT VALID`** on the cloned local DB — legacy prod rows that predate the `time_log_tasks_project_match` constraint still exist. Constraints enforce new rows only. This is local-only; production is unaffected.
