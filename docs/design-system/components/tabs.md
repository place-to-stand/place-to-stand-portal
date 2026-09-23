# Tabs

Segmented tabs on Base UI Tabs, kept on the Radix names `TabsList`/`TabsTrigger`/`TabsContent`. From `@pts/ui/tabs`.

**Look:** `TabsList` is `bg-muted h-9 rounded-lg p-[3px]`; `TabsTrigger` is `rounded-md px-2 py-1 text-sm font-medium`. Active (`data-active`) is `bg-background shadow-sm` (dark: `bg-input/30 border-input`); inactive hovers `bg-muted/60`.

**Variants in use:** `TabsNav` (`components/layout/tabs-nav.tsx`) is the PageShell toolbar row: `h-10 bg-muted/40 gap-2 p-1`, triggers `px-3 py-1.5`, each tab a real `<Link>` via `asChild` (so the URL is the state, e.g. the project workspace `tasks · overview · review · time-logs · activity · archive`).

**Compact switch:** to flip what a sheet is showing (not to navigate), `SheetSwitch` in `settings/templates/_components/template-sheet.tsx` shrinks the same Tabs to `TabsList h-7 p-0.5` and `TabsTrigger px-2 text-xs`, with a muted `text-xs` label beside it ("Recipient", "Format"). Reuse that rather than hand-rolling a toggle.

**Rules:** style against `data-active`, never `data-[state=active]`; use `asChild` for navigable tabs; labels are one or two words, sentence case.
