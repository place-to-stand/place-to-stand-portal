# Tabs

Segmented tabs on Base UI Tabs, kept on the Radix names `TabsList`/`TabsTrigger`/`TabsContent`. From `@pts/ui/tabs`.

**Look:** `TabsList` is `bg-muted h-9 rounded-lg p-[3px]`; `TabsTrigger` is `rounded-md px-2 py-1 text-sm font-medium`. Active (`data-active`) is `bg-background shadow-sm` (dark: `bg-input/30 border-input`); inactive hovers `bg-muted/60`.

**Variants in use:** `TabsNav` (`components/layout/tabs-nav.tsx`) is the PageShell toolbar row: `h-8 bg-muted/40 gap-2 px-1 py-0.5` (32px, the height of the toolbar button, so the row is no taller than its tallest control; the 4px inset on the left is matched by `pr-1` after the action button, so both ends sit 4px in from the card edge). The classes are `TOOLBAR_TABS_LIST_CLASS` / `TOOLBAR_TAB_CLASS`, which the project board's own tab strip reuses; a filter in the toolbar uses `TOOLBAR_FILTER_TRIGGER` (`components/ui/field-trigger.tsx`) so it is 32px too and the row never grows, triggers `h-full flex-none px-3 py-0` so the strip hugs the left edge (`w-fit max-w-full`, scrolling sideways when it outgrows the screen), each tab a real `<Link>` via `asChild` (so the URL is the state, e.g. the project workspace `tasks · review · time-logs · activity · archive`).

**Compact switch:** to flip what a sheet is showing (not to navigate), `SheetSwitch` in `settings/templates/_components/template-sheet.tsx` shrinks the same Tabs to `TabsList h-7 p-0.5` and `TabsTrigger px-2 text-xs`, with a muted `text-xs` label beside it ("Recipient", "Format"). Reuse that rather than hand-rolling a toggle.

**In a sheet:** no tabs. Use `SheetSection`s instead (comments last).

**Rules:** style against `data-active`, never `data-[state=active]`; use `asChild` for navigable tabs; labels are one or two words, sentence case. (guard: eslint `pts/no-radix`; review)
