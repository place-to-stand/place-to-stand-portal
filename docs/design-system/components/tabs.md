# Tabs

Segmented tabs on Base UI Tabs, kept on the Radix names `TabsList`/`TabsTrigger`/`TabsContent`. From `@pts/ui/tabs`.

**Look:** `TabsList` is `bg-muted h-9 rounded-lg p-[3px]`; `TabsTrigger` is `rounded-md px-2 py-1 text-sm font-medium`. Active (`data-active`) is `bg-background shadow-sm` (dark: `bg-input/30 border-input`); inactive hovers `bg-muted/60`.

**Variants in use:** `TabsNav` (`components/layout/tabs-nav.tsx`) is the PageShell toolbar row: `h-10 bg-muted/40 gap-2 p-1`, triggers `flex-none px-3 py-1.5` so the strip hugs the left edge (`w-fit max-w-full`, scrolling sideways when it outgrows the screen), each tab a real `<Link>` via `asChild` (so the URL is the state, e.g. the project workspace `tasks · review · time-logs · activity · archive`).

**Compact switch:** to flip what a sheet is showing (not to navigate), `SheetSwitch` in `settings/templates/_components/template-sheet.tsx` shrinks the same Tabs to `TabsList h-7 p-0.5` and `TabsTrigger px-2 text-xs`, with a muted `text-xs` label beside it ("Recipient", "Format"). Reuse that rather than hand-rolling a toggle.

**In a sheet:** only `SheetTabs` (`components/sheets/sheet-tabs.tsx`), the line tabs under the header. No inner tab group inside a sheet; use `SheetSection`s instead (comments last).

**Rules:** style against `data-active`, never `data-[state=active]`; use `asChild` for navigable tabs; labels are one or two words, sentence case.
