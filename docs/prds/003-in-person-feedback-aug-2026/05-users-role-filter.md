# 05 — Users: Role + Access Filters

**Depends on:** Nothing (parallelizable)
**App:** `apps/internal/`
**Decisions:** D10 (see [README.md](README.md))
**Review codes:** W10, W11, W12, I4 (see [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md))

## Problem

The Users settings page ([settings/users/page.tsx](<../../../apps/internal/app/(dashboard)/settings/users/page.tsx>))
has no filters — only `cursor`/`dir`/`limit` pagination params. Ask: "Add dropdown filters to see
all vs admin vs client users (use submissions as example)." Per the structure Q&A, the access axis
(`disabled_at` — Enabled/Disabled) is included as a second filter.

The pattern to copy is
[submissions-filters.tsx](<../../../apps/internal/app/(dashboard)/submissions/_components/submissions-filters.tsx>) —
the app's only searchParams-driven dropdown-filter component: shadcn `Select`s, an `'all'` sentinel
mapping to *param removed*, server-side filtering, a `basePath` prop serving both the main and
archive tabs, and a boolean prop hiding tab-irrelevant filters.

## Fix

A `users-filters.tsx` row above the users table: **Role** (All users / Admin / Client) on both tabs,
**Access** (All access / Enabled / Disabled) on the active tab only (archived users render `—` for
access). URL params `role` + `access`; changing either clears `cursor` **and** `dir` (keyset
pagination — a stale cursor against a filtered set must be impossible). The "Total users" count
follows the filters automatically because `totalCount` is computed from `baseConditions`.

## Implementation

### 1. Shared constants — new `apps/internal/lib/settings/users/filters.ts`

**(W10)** Named `filters.ts`, NOT `constants.ts` — `lib/settings/users/` already exists (services,
state, validation) and already contains a `state/constants.ts`; a second `constants.ts` one
directory apart invites confusion.

Mirror [lib/form-submissions/constants.ts](../../../apps/internal/lib/form-submissions/constants.ts) (~L3–23):

```ts
// (W11) import via the app-side re-export, matching every other consumer incl. the
// form-submissions precedent — NOT '@pts/db/schema' directly
import { userRole } from '@/lib/db/schema'         // pgEnum('user_role', ['ADMIN','CLIENT'])

import type { UserRoleValue } from '@/lib/types'   // already derived from the same enum — reuse, don't mint a twin

export const USER_ROLE_VALUES = userRole.enumValues
export const USER_ROLE_LABELS: Record<UserRoleValue, string> = { ADMIN: 'Admin', CLIENT: 'Client' }
export const isUserRole = (v: string | undefined): v is UserRoleValue => ...

export const USER_ACCESS_VALUES = ['enabled', 'disabled'] as const
export type UserAccessFilter = (typeof USER_ACCESS_VALUES)[number]
export const USER_ACCESS_LABELS: Record<UserAccessFilter, string> = { enabled: 'Enabled', disabled: 'Disabled' }
export const isUserAccess = (v: string | undefined): v is UserAccessFilter => ...
```

Update
[users-table-row.tsx](<../../../apps/internal/app/(dashboard)/settings/users/components/table/users-table-row.tsx>)
to import `USER_ROLE_LABELS` from here (deleting its local `ROLE_LABELS`, ~L15–18).

### 2. Filter component — new `apps/internal/app/(dashboard)/settings/users/_components/users-filters.tsx`

Copy the submissions component's shape: `'use client'`; props
`{ basePath: string; role?: UserRoleValue; access?: UserAccessFilter; showAccessFilter: boolean }`;
the `updateParams` writer (`URLSearchParams` clone → set/delete → `router.push`); the `ALL = 'all'`
sentinel. One difference from submissions: on change, also **clear `cursor` and `dir`** (users use
keyset pagination, not `page`):

```tsx
onValueChange={value =>
  updateParams({ role: value === ALL ? undefined : value, cursor: undefined, dir: undefined })
}
```

Two `Select`s (`SelectTrigger` ~`w-[160px]`): Role — "All users" / map over `USER_ROLE_VALUES`;
Access (rendered only when `showAccessFilter`) — "All access" / Enabled / Disabled. Container:
`flex flex-col gap-2 sm:flex-row sm:items-center`.

### 3. Query — [apps/internal/lib/queries/users/settings.ts](../../../apps/internal/lib/queries/users/settings.ts)

Extend the input type (L26–31) with `role?: UserRoleValue; access?: UserAccessFilter`, then in
`baseConditions` (L72–78):

```ts
if (input.role) baseConditions.push(eq(users.role, input.role))
if (input.access === 'enabled') baseConditions.push(isNull(users.disabledAt))
if (input.access === 'disabled') baseConditions.push(isNotNull(users.disabledAt))
```

**(I4)** `eq` (and `isNotNull`) are **not currently imported** in this file — add them to the
`drizzle-orm` import (L3). Raw `` sql`… IS NOT NULL` `` would also match the file's existing
`deletedAt` style; either is fine, `isNotNull` preferred.

`totalCount` (L123–128) already derives from `baseConditions` → the header count corrects itself.
Keyset pagination and `limit + 1` logic untouched. **(I4)** The pages import this via the
`@/lib/queries/users` barrel, which re-exports the input type — no barrel edit needed.

### 4. Pages

[settings/users/page.tsx](<../../../apps/internal/app/(dashboard)/settings/users/page.tsx>):
parse + validate with the type guards (submissions precedent:
[submissions/page.tsx](<../../../apps/internal/app/(dashboard)/submissions/page.tsx>) ~L43–47, incl. a
`firstParam` helper for `string | string[]`), pass `role`/`access` to `listUsersForSettings`, render
`<UsersFilters basePath='/settings/users' role={role} access={access} showAccessFilter />` inside
the table `<section>` — and add `space-y-4` to that section's className (L93) so the filter row
separates from the table, matching submissions.

**(I4)** Both users pages currently inline a verbose ternary parse of `cursor`/`dir`/`limit`,
duplicated **verbatim** across the two files (L26–46 in each) — adding role/access parsing inline
would triplicate it. Extract a shared `parseUsersSearchParams` helper (e.g. alongside the filter
constants in `lib/settings/users/filters.ts`) that both pages call; note `firstParam` is a new idiom
for these files, imported from nowhere — define it in the helper.

[settings/users/archive/page.tsx](<../../../apps/internal/app/(dashboard)/settings/users/archive/page.tsx>):
same, with `basePath='/settings/users/archive'`, `showAccessFilter={false}`, and only `role` passed
to the query.

[users-management-table.tsx](<../../../apps/internal/app/(dashboard)/settings/users/_components/users-management-table.tsx>):
`handlePaginate` (L62–75) clones the existing `URLSearchParams`, so `role`/`access` survive
pagination automatically — verified, no change needed. Add a filtered-empty-state message (e.g. "No
users match the current filters") when a filter is active and rows are empty, alongside the existing
`EMPTY_MESSAGES` (L27–30). **(I4)** The component already calls `useSearchParams()` (L41) — read
`role`/`access` from there to detect an active filter; **no prop drilling** through
`UsersTableSection` or the pages.

## Architecture notes

- Server-side filtering keeps parity with pagination and the count; no client-side row filtering is
  added (the existing belt-and-braces `deleted_at` pass at ~L52–58 stays as-is).
- Invalid param values (e.g. `?role=SUPERADMIN`) fail the type guard → treated as unset, matching
  submissions.
- Access is orthogonal to the Users/Archive tabs: a disabled user is still *active* (not archived).
  No schema changes.

## Acceptance criteria

- [ ] Role filter on `/settings/users`: All users / Admin / Client; table + "Total users" count follow it
- [ ] Access filter on `/settings/users`: All access / Enabled / Disabled; combinable with role
- [ ] Archive tab has the role filter only (no access dropdown)
- [ ] Filters live in the URL (`?role=CLIENT&access=disabled`), survive reload and back/forward, and default to All with no params
- [ ] Changing a filter resets pagination (clears `cursor` + `dir`); paginating preserves active filters
- [ ] Invalid param values are ignored (fall back to All)
- [ ] Filtered empty state shows a clear message; unfiltered empty states unchanged
- [ ] Access toggle in a row (PR #108 feature) still works while filters are active; **(W12)** a user disabled while viewing `access=enabled` disappears **immediately** — the toggle's own `router.refresh()` re-runs the filtered query; this is correct expected behavior (success toast confirms the action)
- [ ] Submissions filters unchanged
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

**New:**
- `apps/internal/app/(dashboard)/settings/users/_components/users-filters.tsx`
- `apps/internal/lib/settings/users/filters.ts` (W10 naming; also hosts `parseUsersSearchParams`, I4)

**Modified:**
- `apps/internal/lib/queries/users/settings.ts`
- `apps/internal/app/(dashboard)/settings/users/page.tsx`
- `apps/internal/app/(dashboard)/settings/users/archive/page.tsx`
- `apps/internal/app/(dashboard)/settings/users/_components/users-management-table.tsx` (filtered empty state)
- `apps/internal/app/(dashboard)/settings/users/components/table/users-table-row.tsx` (import lifted labels)
