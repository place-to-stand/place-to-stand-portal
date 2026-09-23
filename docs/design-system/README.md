# Place To Stand design system

The visual and copy conventions for both portals, extracted from the code and kept next to it. **Read this before any UI, styling, mockup, or copy work**, then open only the component notes the task touches.

## Where the truth lives

This folder describes; the code decides. When they disagree, the code wins and this folder is wrong: fix it in the same change.

| What | Source of truth | Here |
| --- | --- | --- |
| Theme colors (light/dark), radius | `apps/internal/app/globals.css` | `tokens.json` (generated) |
| Brand colors (auth screens, logo) | `packages/ui/src/brand.tsx` (`BRAND`) | `tokens.json` (generated) |
| Email colors | `packages/email/src/layout.ts` (`EMAIL_COLORS`) | `tokens.json` (generated) |
| Fonts | `apps/internal/app/layout.tsx` | this README |
| Components | `packages/ui/src/*`, `apps/internal/components/ui/*` | `components/*.md` |
| Sheet header accent colors | `apps/internal/lib/entity-accents.ts` | `components/sheet.md` |

`tokens.json` color values and the radius scale are written by `npm run design-tokens` (from the repo root), which reads the sources above and keeps the hand-written usage notes. `npm run lint` fails when the file is stale. Type, spacing, size, shadow and opacity entries are hand-written.

**Before adding anything new** (a component, a color, a pattern), look for an existing one in `packages/ui` or `apps/internal/components` and reuse it, even if that bends the design slightly. The Settings → Templates galleries are a worked example: `PageShell`, the shared list toolbar (`components/table-toolbar/*`), `Badge`, `Tabs` and `SheetFormHeader`, all reused.

## Files

- `README.md`: this brand book.
- `tokens.json`: every token with a usage note.
- `components/`: one note per component family: badge, brand-logo, button, card, dialog, dropdown-menu, input, select, sheet, switch, table, tabs.

## The product

Place To Stand is a small software agency. This system describes its two Next.js portals. The **internal portal** is an admin-only workspace where staff run clients, contacts, leads, projects, task boards, time logs, hour blocks, invoices and monthly close. The **client portal** is where client users see their projects and link GitHub. Both share one component package (`@pts/ui`, Base UI primitives styled with Tailwind v4) and one theme. The portals are working tools: dense, neutral and quiet. The brand shows up in only a few places: the logo, the signed-out screens, public share pages and email.

## Content fundamentals

- **Sentence case everywhere.** Buttons, titles, tabs and toasts: "Add lead", "Save changes", "Project archived". Title Case is only for the brand name.
- **The name.** The wordmark reads **Place To Stand**, with a capital T, as `BrandLogo` renders it. The favicon abbreviation is **PTS**. Some older page metadata still says "Place to Stand Portal". Use the wordmark casing in new copy.
- **Verbs first on actions.** "Archive client", "Mark as sent", "Copy link". A destructive action names what it destroys, so it never needs color to carry the meaning.
- **Toasts are short and past tense on success** ("Time entry removed", "Closed month"). On failure they read **"Unable to <verb> <noun>"** ("Unable to save invoice"), with the reason in the description.
- **Empty states are one plain sentence.** "No leads yet", "No matching tasks." There's no illustration and no pep.
- **Minimal helper copy.** Don't add a hint under a field unless it changes the decision someone is about to make. A section gets at most one line of context. Mark optional fields with `<FormLabel optional>`, which appends a muted "(optional)", instead of explaining them.
- **Counts and dates are data.** Write "Showing 24 of 118 clients". Format every date with `formatCalendarDate` (`lib/dates.ts`), which gives "Sep 23, 2026". It reads date-only values in UTC and timestamps in `America/Los_Angeles`, so server and client always agree. Never call an ambient-timezone `format()` directly: that caused hydration errors and off-by-one dates.
- No emoji, no exclamation marks, no marketing adjectives inside the app.

## Visual foundations

### Color
- **The UI is neutral: shadcn's gray oklch palette** in a light and a dark theme. The theme comes from a `.dark` class on `<html>` (the user's choice, else `prefers-color-scheme`). Build with the semantic tokens and never with raw grays:
  - `background` / `foreground` for the page and its text.
  - `card`, `popover` for raised surfaces.
  - `muted` / `muted-foreground` for recessed grounds and secondary text.
  - `accent` for hover and highlight.
  - `border` / `input` / `ring` for edges and focus.
- **`primary` is ink, not a hue.** It's near-black in light mode and near-white in dark. Text on it is always `primary-foreground`. Use one primary Button per view, for the thing the view is for.
- **`destructive`** is the only chromatic UI token. It fills the destructive Button and Badge (white label; 60% fill in dark) and colors invalid-field borders and rings.
- **`chart-1`–`chart-5`** are for data series only. Their hues change between themes, so never describe a series by its color.
- **Status colors outside the tokens.** A few status marks use Tailwind palette colors directly: the checked Switch is `emerald-500`, and the dev-environment band in the sidebar is `amber-500` with `amber-950` text. Treat these as fixed exceptions, not a palette to extend.
- **The brand lime `brand-lime` (#b5f542) is used sparingly and only on dark grounds.** It belongs to `brand-bg` (#0e0f11): the auth screens, the dark email masthead, and the dark theme's logo mark. On white it all but vanishes, so:
  - Use `brand-lime-600` (#65a30d) for the mark in the light theme.
  - Use `email-accent-ink` (#4d7c0f, lime-700) for any lime text on paper.
  - Never put lime on a UI control, and never use it as a status color.
- **Email paper.** A `.email-paper` subtree (the third block in `globals.css`) re-declares the light tokens. An email being composed or reviewed then renders white with dark ink, even when the app is dark, which is how a mail client will show it. Emails use the `email-*` tokens: a dark `brand-bg` masthead over an `email-paper` body on an `email-backdrop` canvas.

### Type
- **Geist (`sans`) for the entire UI.** The working size is `ui` (text-sm, 14px), and labels and buttons use `ui-medium`. Other sizes:
  - `caption` (12px) for metadata.
  - `overline` (11px, semibold, uppercase, tracking-wide) for group labels.
  - `micro` (10px) for count pills.
  - Inputs use `body` (16px) below the `md` breakpoint so iOS doesn't zoom, then 14px.
- **Space Grotesk (`display`) is the brand face**, used only for:
  - the wordmark (`wordmark`: bold, tracking-tight, leading-none)
  - signed-out headlines (`auth-title`)
  - public share-page and email headings (`share-headline`)

  Never use it for UI labels.
- **Geist Mono (`mono`) for identifiers**: slugs (`code`), shortcut keys (`kbd`), and the uppercase `mono-label` under the brand lockup. Use `tabular-nums` for any column of numbers: hours, money, counts.
- Headings are few. Dashboard pages title themselves through the breadcrumb in the `PageShell` header row. `page-title` is only for standalone pages.

### Space, size, radius
- Tailwind's 4px scale is used as written (`space-*`). A control row shares one height: `control-md` (h-9, 36px) is the default, with `control-sm` 32px and `control-xs` 28px for dense rows and `control-lg` 40px.
- Radii derive from one base, `radius` = 0.625rem:
  - `radius-sm` 6px: items inside menus
  - `radius-md` 8px: buttons, inputs, triggers, popovers
  - `radius-lg` 10px: dialogs, tab tracks
  - `radius-xl` 14px: cards
  - `radius-full`: badges, switches, avatars
  - The Checkbox uses 4px (`radius-checkbox`).

### Surfaces, borders, elevation
- **Borders do the work.** Every element defaults to `border-border`. Cards are `card` + border + `radius-xl` + `shadow-sm`. Popovers are `popover` + border + `radius-md` + `shadow-md`. Sheets and dialogs are `background` + `shadow-lg`, over a black backdrop (`overlay-sheet` 50%, `overlay-dialog` 70%).
- **Layout.** The app shell is `muted`. Each page is a `PageShell`:
  - one compact header row (sidebar trigger, a vertical separator, the breadcrumb, then an optional right slot) on `background`, with a bottom border
  - an optional toolbar row (tabs, the count, one primary action)
  - the scrolling content. The body itself never scrolls.
- **The left sidebar** uses the `sidebar-*` tokens and collapses to icons. When collapsed, the blueprint mark stands in for the logo.
- **Entities open in sheets, not pages.** Sheets are right-side panels over the list, sized `sm`–`xwide`. They're addressed by a query param (`?task=<uuid>`, `?client=new`).

### States and motion
- **Focus** on every control is `focus-visible:border-ring` plus a 3px `ring-ring/50` halo (`focus-ring`). An invalid field swaps both to `destructive` (the ring at 20%, 40% in dark).
- **Hover.** Ghost, outline and menu items fill with `accent`. Primary and destructive fills drop to 90%. Table rows take `muted`/50.
- **Disabled** is `opacity-50` with pointer events off (`disabled`).
- **Transitions** are Tailwind `transition-*` utilities (hover fades, chevron rotations). A collapsible that should open smoothly animates `h-(--collapsible-panel-height)` to and from `data-starting-style:h-0` / `data-ending-style:h-0`, with `motion-reduce:transition-none` (see `template-sheet.tsx`).
- **Motion** is `tw-animate-css`:
  - Popovers fade and zoom from 95%, sliding 2 units from their trigger side.
  - Sheets slide from the right, 300ms both ways.
  - Dialogs fade and zoom in 200ms.
  - A sheet that remounts while already open skips its entry animation.

### Brand ground
Signed-out screens (`AuthShell`) are always dark, whatever the user's theme, because they're the handoff from the marketing site. The layout, top to bottom:
- a `brand-bg` field with a 24px dot grid in `brand-border`
- the `BrandLockup`: a 36px blueprint mark, the Space Grotesk wordmark in `brand-text`, and a lime `mono-label`
- a square, translucent `brand-bg-panel` form panel with a `brand-border`

`BlueprintCorners` (lime brackets on two corners of a card) belongs to this ground and to share pages. Keep it out of the app.

## Iconography

- **lucide-react only.** 148 source files import it. Icons are stroke glyphs at 2px stroke with `currentColor`.
- **Sizing is automatic**: `size-4` (16px) in buttons, menu items and select items, `size-3` in badges, `size-3.5` in `icon-sm` row actions and checkbox checks.
- **Color**: icons in menus and select items are `muted-foreground`. Icons in buttons take the label color.
- **Common glyphs**: ChevronDown for select triggers, Check for selected items, X for sheet and dialog close, ChevronRight for submenus.
- No emoji, no filled icon sets, no custom glyph font (the TipTap editor ships its own small `tiptap-icons` set, for the editor toolbar only).
- **Logo.** The logo is the `BrandLogo` lockup, which is drawn in CSS and not an image file: a square 1px frame at 50–60% opacity holding a dot a third of its size, then "Place To Stand" in Space Grotesk. The PTS tile with lime corner brackets (Logos group) is the favicon and apple-touch icon **only**. Never use it as an in-app logo.

## House rules (verified in code)

1. **Every primitive is `@base-ui/react`.** Radix is gone. `asChild` still works through a `useRender`-based `Slot` (`packages/ui/src/slot.tsx`). State attributes are Base UI's: `data-active` on tabs, `data-checked` / `data-unchecked` on switch and checkbox, `data-highlighted` / `data-open` / `data-closed` on popups. Don't write `data-[state=…]`.
2. **Base UI menu and select items need explicit `hover:` classes.** `data-highlighted` doesn't fire on plain mouse hover. Every item pairs `data-highlighted:bg-accent` with `hover:bg-accent hover:text-accent-foreground`.
3. **Button has `gap-2` built into every size.** Never add `mr-*` or `ml-*` to an icon inside a Button. Put the icon first as a child and let the gap space it ("Add lead").
4. **Dropdown, select and popover popups align left by default.** The wrappers default to `align='start'`. Never pass `align='start'` at a call site. Pass an explicit `align` only when you mean to deviate.
5. **Sortable tables use `layout='fixed'`.** Give every header a width class and `truncate` long-text cells, so sorting and paging can't make columns jump.
6. **Sheet Save is always enabled.** Never gate Save on `isDirty` or has-changes. Disable it only while a save is in flight or when a real validation precondition fails.
7. **Save means done, which closes the sheet.** A successful save closes the sheet, for create and edit alike. A create sheet never turns into an edit sheet.
8. **Controls inside a sheet apply on save.** Bind them to the form and apply in the save action. Never fire an immediate mutation from inside an edit sheet. Table-row toggles may stay instant.
9. **Minimal helper copy.** See Content fundamentals.
10. **Dates go through `formatCalendarDate`.**
