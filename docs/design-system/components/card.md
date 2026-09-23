# Card

Surfaces: `Card` for grouped content on the muted app shell, plus the floating `Popover` and `Tooltip`. From `apps/internal/components/ui/card.tsx`, `@pts/ui/popover`, `@pts/ui/tooltip`.

**Card:** `bg-card text-card-foreground rounded-xl border py-6 shadow-sm gap-6`; `CardHeader` px-6 grid with an optional `CardAction` top-right; `CardTitle` `leading-none font-semibold`; `CardDescription` text-sm muted; `CardContent`/`CardFooter` px-6.

**Popover:** `bg-popover border rounded-md p-4 shadow-md w-72`, left-aligned to its trigger by default (never pass `align='start'`). `HoverCard` is the hover-triggered variant.

**Tooltip:** `bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs` with a matching arrow. A few words; never essential information.

**Don't:** add colored left borders, gradients, or heavier shadows; separate by border first.
