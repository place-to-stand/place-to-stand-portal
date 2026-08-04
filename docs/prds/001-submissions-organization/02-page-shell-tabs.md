# 02 — Page Shell: Hour-Blocks Layout + List / Archive / Activity Tabs

**Depends on:** nothing (03/04/05 build on this)
**Blocks:** [03-acknowledge-unread.md](03-acknowledge-unread.md), [04-archive-restore.md](04-archive-restore.md), [05-activity-events.md](05-activity-events.md)
**Decisions:** D3, D4, D5 (see [README](README.md))

## Problem statement

The submissions page is a one-off layout: the kind/status filters and the total count live *inside* the card, and there is no navigation structure for the archive and activity views this PRD adds. The owner directed reusing the hour-blocks shell so "the filters and count are all in the same place and the card behind the list looks the same."

Reference implementation to mirror (do not modify):
- `apps/internal/app/(dashboard)/hour-blocks/page.tsx` — tabs row above the card, count on the right, `<section className='bg-background rounded-xl border p-6 shadow-sm'>`
- `apps/internal/app/(dashboard)/hour-blocks/_components/hour-blocks-tabs-nav.tsx` — route-based `Tabs` using `router.push`
- `apps/internal/app/(dashboard)/hour-blocks/archive/page.tsx`, `activity/page.tsx`

## Fix description

Restructure `/submissions` into three routes sharing a tabs nav and card shell. Extract the filters out of `SubmissionsTable` into a standalone client component rendered in the tabs row. Give `SubmissionsTable` a `mode` prop so sections 03/04 can vary row actions. Archive and Activity pages are stubbed here and completed in 04/05.

## Implementation details

### 1. `_components/submissions-tabs-nav.tsx` (new)

Copy `hour-blocks-tabs-nav.tsx` structurally:

```tsx
'use client'
// Tabs + router.push, same as HourBlocksTabsNav

type SubmissionsNavTab = 'submissions' | 'archive' | 'activity'

const SUBMISSIONS_TABS: Array<{ label: string; value: SubmissionsNavTab; href: string }> = [
  { label: 'Submissions', value: 'submissions', href: '/submissions' },
  { label: 'Archive', value: 'archive', href: '/submissions/archive' },
  { label: 'Activity', value: 'activity', href: '/submissions/activity' },
]

export function SubmissionsTabsNav({ activeTab, className }: SubmissionsTabsNavProps) { … }
```

Same `TabsList` styling: `bg-muted/40 h-10 w-full justify-start gap-2 rounded-lg p-1 sm:w-auto`.

### 2. `_components/submissions-filters.tsx` (new)

Move the two `Select` controls (kind, status) out of `submissions-table.tsx` verbatim, including the `updateParams` URL-state logic and the reset-to-page-1 comment. Props:

```ts
type SubmissionsFiltersProps = {
  activeKind?: FormSubmissionKind
  activeStatus?: FormSubmissionStatus
  /** Base path to push filter changes to — '/submissions' or '/submissions/archive'. */
  basePath: string
}
```

`updateParams` pushes to `basePath` instead of the hardcoded `/submissions` so the archive page keeps its own filters. Kind/status filters remain valid on the archive view (an archived audit is still an audit).

### 3. `page.tsx` (modified)

Keep `requireRole('ADMIN')`, param parsing, and `fetchFormSubmissions` exactly as-is. Replace the body layout, mirroring `hour-blocks/page.tsx`:

```tsx
<AppShellHeader>…unchanged title/description…</AppShellHeader>
<div className='space-y-4'>
  {/* Tabs Row - Above the main container */}
  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
    <SubmissionsTabsNav activeTab='submissions' className='flex-1 sm:flex-none' />
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6'>
      <SubmissionsFilters activeKind={kind} activeStatus={status} basePath='/submissions' />
      <span className='text-muted-foreground text-sm whitespace-nowrap'>
        Total submissions: {totalCount}
      </span>
    </div>
  </div>
  {/* Main Container with Background */}
  <section className='bg-background rounded-xl border p-6 shadow-sm'>
    <SubmissionsTable … mode='active' />
  </section>
</div>
```

(Submissions has no equivalent of `HourBlocksAddButton` — rows only arrive via the intake webhook — so the right side of the tabs row is filters + count only.)

### 4. `_components/submissions-table.tsx` (modified)

- Remove the filter `Select`s and the `Total submissions` span (now in the tabs row). The component keeps: table, pagination, detail sheet, and the `updateParams` pagination pushes (parameterize the push target with the same `basePath` prop, defaulting per mode).
- Add `mode: 'active' | 'archive'` to props (mirrors `HourBlocksManagementTable`'s `mode`). In this section `mode` only threads through; 03 uses it to gate the unread indicator/acknowledge, 04 uses it for archive vs restore actions.
- Empty state copy varies by mode: `'No submissions yet.'` / `'No archived submissions.'`

### 5. `archive/page.tsx` (new — stub completed in 04)

Clone of `page.tsx` with `activeTab='archive'`, `mode='archive'`, count label `Total archived: {totalCount}`, description "Review archived submissions and restore them when needed.", and a data fetch that targets archived rows. The `archived: true` fetch option lands in section 04 — until then, pass an empty `items` array / zero count in the stub rather than calling the active-rows fetch (otherwise the Archive tab would misleadingly list active submissions).

### 6. `activity/page.tsx` (new — stub completed in 05)

Clone of `hour-blocks/activity/page.tsx` shape: `requireRole('ADMIN')`, tabs row with `activeTab='activity'` (no filters/count on this tab, same as hour blocks), card section containing the activity feed component from section 05.

## Architecture review notes

- Route-based tabs (real pages, not client tab-panels) match hour blocks and keep each view server-rendered with its own `searchParams` — pagination and filters stay URL-addressable.
- `metadata.title` per route: `'Submissions'`, `'Submissions Archive'`, `'Submissions Activity'` (hour blocks appends `| Settings`; submissions is not under settings, so plain titles).
- The existing `matchHrefs: ['/submissions']` in `navigation-config.ts` already prefix-matches `/submissions/archive` and `/submissions/activity` via the sidebar's `startsWith` logic — no nav change needed in *this* section. (Section 06 does modify the nav item: badge plumbing + the D10 `roles: ['ADMIN']` restriction.)

## Acceptance criteria

- [ ] `/submissions`, `/submissions/archive`, `/submissions/activity` all render with the shared tabs nav, correct active tab, and the hour-blocks card styling (`bg-background rounded-xl border p-6 shadow-sm`)
- [ ] Kind/status filters and total count render in the tabs row (right side) on List and Archive tabs, not inside the card
- [ ] Filtering by kind/status updates the URL, resets to page 1, and stays on the current tab
- [ ] Pagination works on the List tab with filters applied (URL state preserved)
- [ ] Detail sheet still opens from a row click; no regression in row rendering
- [ ] All three routes are admin-gated (`requireRole('ADMIN')`); a CLIENT user hits the unauthorized flow
- [ ] Sidebar "Submissions" item shows active state on all three routes
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `apps/internal/app/(dashboard)/submissions/_components/submissions-tabs-nav.tsx` (new)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-filters.tsx` (new)
- `apps/internal/app/(dashboard)/submissions/page.tsx` (modified)
- `apps/internal/app/(dashboard)/submissions/_components/submissions-table.tsx` (modified)
- `apps/internal/app/(dashboard)/submissions/archive/page.tsx` (new)
- `apps/internal/app/(dashboard)/submissions/activity/page.tsx` (new)
