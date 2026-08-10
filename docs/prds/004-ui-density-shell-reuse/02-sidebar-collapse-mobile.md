# 02 — Sidebar: shadcn Adoption, Icon Collapse, Mobile Drawer

**Depends on:** Nothing — lands first (supplies `SidebarProvider`/`SidebarTrigger` to 01)
**App:** `apps/internal/`
**Decisions:** D4 (see [README.md](README.md))

## Problem

[sidebar.tsx](../../../apps/internal/components/layout/sidebar.tsx) is a ~140-line custom component: hard-coded `w-56`, `hidden md:flex` — **below 768px it disappears and nothing replaces it**; mobile users cannot navigate between sections at all. No collapse state, no trigger, no persistence, no tooltips. The `--sidebar-*` theme tokens exist in `globals.css` (light ~L75–82, dark ~L110–117) but are unused (`bg-background/90` instead). Active-route matching is duplicated verbatim between `sidebar.tsx` (~L79–89) and `app-shell.tsx` (~L74–87).

## Fix

Adopt the shadcn sidebar primitive (D4): `npx shadcn@latest add sidebar` → `components/ui/sidebar.tsx`, then re-home the existing nav into it with `collapsible="icon"`. This delivers in one move: icon collapse, `SidebarTrigger`, `⌘B`, cookie-persisted state (SSR-read, no flicker), tooltips-when-collapsed (`SidebarMenuButton tooltip` prop), and the `Sheet`-based mobile drawer.

## Implementation

### 1. Add the primitive

- `npx shadcn@latest add sidebar`. **Do not** let it overwrite [hooks/use-mobile.ts](../../../apps/internal/hooks/use-mobile.ts) — the existing `useIsMobile(breakpoint = 768)` is API-compatible; point the generated import at it and delete the duplicate.
- All other deps (tooltip, sheet, button, separator, skeleton, input, `@radix-ui/react-slot`) are already installed. The `--sidebar-*` tokens are already themed — zero CSS work expected.

### 2. Rebuild `components/layout/sidebar.tsx` on the primitives

Map the existing structure ([navigation-config.ts](../../../apps/internal/components/layout/navigation-config.ts) is unchanged):

| Current | Becomes |
|---|---|
| `<aside class='w-56 …'>` | `<Sidebar collapsible='icon'>` |
| Logo block (theme-aware, `max-w-[140px]`) | `SidebarHeader`; collapsed state shows a square icon mark (add a small logo glyph asset or the "P" mark) — full wordmark hides via `group-data-[collapsible=icon]:hidden` |
| Dev "Development" pill | Collapsed: amber dot with tooltip; expanded: unchanged pill |
| `NAV_GROUPS` map | `SidebarGroup` + `SidebarGroupLabel` (auto-hidden when collapsed) + `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton asChild tooltip={item.label}` around the existing `<Link>` |
| Active detection | import from `lib/navigation/active-route.ts` (extracted here or in 01 — whichever lands first; single source ends the duplication) |
| Badge pill (`ml-auto`, `99+` cap, sr-only text) | `SidebarMenuBadge` when expanded; when collapsed, an absolute-positioned dot on the icon (custom — `SidebarMenuBadge` hides in icon mode) |
| Footer `UserMenu` | `SidebarFooter`; `UserMenu` trigger gains a compact square variant for collapsed state (name/role column already `hidden sm:flex`) |

Preserve the current compact visual language: `text-[12px]` labels, `size-3.5` icons, `text-[11px]` uppercase group labels — set via className overrides on the primitives, not by editing `components/ui/sidebar.tsx`.

### 3. Wire the provider + persistence

[app/(dashboard)/layout.tsx](<../../../apps/internal/app/(dashboard)/layout.tsx>) is already an async server component: read the `sidebar_state` cookie via `cookies()` and pass `defaultOpen` to `SidebarProvider` (the primitive writes the cookie on toggle). Wrap `AppShell`'s flex row: `SidebarProvider` → `Sidebar` + `SidebarInset`.

**Watch-item:** the app's scroll model is `html { h-screen overflow-hidden }` + `app-shell.tsx`'s `flex h-screen overflow-hidden` with inner `overflow-y-auto` panes. `SidebarInset` assumes a slightly different flex model — expect one reconciliation pass; the invariant to preserve is *the page body never scrolls; inner panes do*.

### 4. Trigger + mobile

- `SidebarTrigger` goes at the far left of the existing header row in `app-shell.tsx` (01 later re-homes it into `PageShell`'s header line).
- Mobile (<768px): the primitive renders the sidebar in a left `Sheet` automatically; the trigger must be visible on mobile (it is, in the header row). This **closes the no-mobile-nav hole** — verify all 12 nav items reachable on a phone viewport.
- `⌘B` toggle ships with the primitive; confirm it doesn't collide with any existing binding (audit found none).

## Architecture notes

- One consumer (`app-shell.tsx:109`) — blast radius is small and the change is shippable independently of 01.
- Collapsed width is the primitive's `--sidebar-width-icon` (3rem default) — matches the icon-rail look requested; expanded width set to `14rem` to match today's `w-56`.

## Acceptance criteria

- [ ] Sidebar collapses to an icon rail via trigger and `⌘B`; expands back; state survives reload (cookie, no flash-of-wrong-state on SSR)
- [ ] Collapsed: every nav item shows a tooltip; badge shows as a dot; logo shows compact mark; user menu still opens
- [ ] Expanded: visually equivalent to today (compact scale, group labels, badge counts, dev pill, theme-aware logo)
- [ ] <768px: trigger opens a sheet drawer with the full nav; all 12 items navigate; drawer closes on navigation
- [ ] Active item highlighting matches current behavior on nested routes (`matchHrefs` respected) — single shared match util
- [ ] Keyboard/AT: trigger has an accessible label; drawer traps focus; `Esc` closes
- [ ] `npm run build`, `npm run lint`, `npm run type-check` pass from the repo root

## Files

All paths under `apps/internal/`.

**New:** `components/ui/sidebar.tsx` (generated) · `lib/navigation/active-route.ts` (if not landed by 01)
**Modified:** `components/layout/sidebar.tsx` (rebuilt on primitives) · `components/layout/app-shell.tsx` (provider/inset/trigger) · `app/(dashboard)/layout.tsx` (cookie → `defaultOpen`) · `components/layout/user-menu.tsx` (compact trigger variant)
**Unchanged:** `components/layout/navigation-config.ts` · `hooks/use-mobile.ts` (moves to `@pts/ui` later, in 04)
