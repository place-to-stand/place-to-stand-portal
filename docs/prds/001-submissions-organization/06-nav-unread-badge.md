# 06 — Sidebar Unread Count Badge

**Depends on:** [01-schema-acknowledgement.md](01-schema-acknowledgement.md), [03-acknowledge-unread.md](03-acknowledge-unread.md)
**Blocks:** nothing
**Decisions:** D1, D6, D10 (see [README](README.md))

## Problem statement

Transcript (00:40:56): "maybe like a number that pops up in the menu in the left menu that just shows how many unread submissions we have." The sidebar ([sidebar.tsx](../../../apps/internal/components/layout/sidebar.tsx)) is a client component with no badge concept, rendered by the client `AppShell`, which is rendered by the server `(dashboard)/layout.tsx` — the only server point that can fetch the count per D6.

## Fix description

Add a SQL unread count matching the D1 predicate, expose it through the data layer, fetch it in the dashboard layout (admin only), and thread it `layout → AppShell → Sidebar` to render a count pill on the Submissions item. Freshness comes from the `revalidatePath('/', 'layout')` calls already specced in 03/04 plus normal navigation re-renders.

## Implementation details

### 1. Query — `apps/internal/lib/queries/form-submissions.ts`

```ts
/**
 * D1 unread predicate — MUST stay in sync with `isUnreadSubmission` in
 * apps/internal/lib/form-submissions/constants.ts. Served by the partial
 * index idx_form_submissions_unread (deleted_at IS NULL AND
 * acknowledged_at IS NULL), which covers the kind/status residual filter.
 */
export async function countUnreadFormSubmissions() {
  const [row] = await db
    .select({ value: count() })
    .from(formSubmissions)
    .where(
      and(
        isNull(formSubmissions.deletedAt),
        isNull(formSubmissions.acknowledgedAt),
        or(
          eq(formSubmissions.kind, 'contact'),
          inArray(formSubmissions.status, ['completed', 'captured'])
        )
      )
    )

  return row?.value ?? 0
}
```

### 2. Data layer — `apps/internal/lib/data/form-submissions/index.ts`

```ts
/**
 * Unlike the other fetchers this does NOT assertAdmin-throw: it renders in
 * the shared dashboard layout for every role. Non-admins get 0 (their
 * sidebar shows no badge; the Submissions page itself still hard-gates).
 */
export const fetchUnreadSubmissionCount = cache(
  async (user: AppUser): Promise<number> => {
    if (!isAdmin(user)) return 0
    return countUnreadFormSubmissions()
  }
)
```

(`isAdmin` from `apps/internal/lib/auth/permissions.ts`.)

### 3. Layout — `apps/internal/app/(dashboard)/layout.tsx`

```tsx
const user = await requireUser()
const unreadSubmissionsCount = await fetchUnreadSubmissionCount(user)

return (
  <AppShell user={user} unreadSubmissionsCount={unreadSubmissionsCount}>
    {children}
  </AppShell>
)
```

### 4. Shell + sidebar plumbing

Keep the mechanism generic-but-minimal — a `badges` map keyed by nav href, so a future count (e.g. leads) reuses it without another prop:

- `app-shell.tsx`: add `unreadSubmissionsCount?: number` to `Props`; build `const navBadges = unreadSubmissionsCount ? { '/submissions': unreadSubmissionsCount } : undefined` and pass `<Sidebar user={user} badges={navBadges} />`.
- `sidebar.tsx`: `badges?: Record<string, number>`. In the internal-link branch, after the label:

```tsx
{badges?.[item.href] ? (
  <span
    className={cn(
      'ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
      isActive
        ? 'bg-primary-foreground/20 text-primary-foreground'
        : 'bg-primary text-primary-foreground'
    )}
  >
    {badges[item.href] > 99 ? '99+' : badges[item.href]}
  </span>
) : null}
```

Zero renders nothing (the map is undefined or the key falsy — never a "0" pill). Cap at `99+`. `aria`: append `sr-only` text `({n} unread)` so screen readers announce it with the link label.

- `navigation-config.ts`: the badge itself needs no config change (keyed by `href`, config stays static), but **D10 lands here**: add `roles: ['ADMIN']` to the Submissions item so CLIENT users no longer see a link that 401s them — the item-level `roles` override already exists on the Canvas item as precedent:

```ts
      {
        href: '/submissions',
        label: 'Submissions',
        icon: Inbox,
        matchHrefs: ['/submissions'],
        roles: ['ADMIN'],
      },
```

### 5. Freshness (D6 recap)

- Acknowledge / archive / restore actions call `revalidatePath('/', 'layout')` (specced in 03/04) → next render shows the new count.
- New submissions arriving via the intake webhook do **not** trigger revalidation; the count updates on the user's next navigation/full render. Accepted trade-off per D6 (no polling). If staleness bites in practice, React Query polling is the documented upgrade path in [07-future-scope.md](07-future-scope.md).

## Architecture review notes

- The count query is the third consumer of the unread predicate after `isUnreadSubmission` and the row indicator — all three are annotated with sync comments; changing D1 means touching exactly two files (`constants.ts`, `queries/form-submissions.ts`).
- Fetching in the layout adds one indexed `COUNT` per dashboard render for admins; the partial index keeps it a small index-only scan. `cache()` dedupes within a render pass.
- Returning 0 for non-admins (instead of throwing) is deliberate: the layout must never crash a CLIENT session over an admin-only ornament.

## Acceptance criteria

- [ ] `countUnreadFormSubmissions` matches the D1 predicate and carries the sync comment
- [ ] Admin sidebar shows a count pill on Submissions when unread > 0; no pill at 0; `99+` above 99
- [ ] CLIENT-role users never see the badge and the layout renders without error for them
- [ ] D10: CLIENT-role users no longer see the Submissions item in the sidebar at all (`roles: ['ADMIN']` on the nav item)
- [ ] Acknowledging a submission decrements the badge on the next render (no hard refresh needed after the action's `router.refresh()`)
- [ ] Archiving an unread submission decrements the badge; restoring it re-increments
- [ ] A new `captured` beacon on a previously acknowledged audit re-increments the badge (D8 end-to-end)
- [ ] Badge count includes unread contact submissions and unread completed/captured audits only — verify with one of each status in the DB
- [ ] Screen reader announces the unread count with the nav link
- [ ] `npm run build && npm run lint && npm run type-check` pass from repo root

## Files likely modified / created

- `apps/internal/lib/queries/form-submissions.ts` (modified)
- `apps/internal/lib/data/form-submissions/index.ts` (modified)
- `apps/internal/app/(dashboard)/layout.tsx` (modified)
- `apps/internal/components/layout/app-shell.tsx` (modified)
- `apps/internal/components/layout/sidebar.tsx` (modified)
- `apps/internal/components/layout/navigation-config.ts` (modified — D10 `roles: ['ADMIN']`)
