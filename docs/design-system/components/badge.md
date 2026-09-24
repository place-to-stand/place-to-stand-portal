# Badge

A small pill of status or category text: `rounded-full border px-2 py-0.5 text-xs font-medium`. From `@pts/ui/badge`.

**Consumer provides:** one or two words; optional 12px icon (`[&>svg]:size-3`, `gap-1`).

**Variants:** `default` (primary fill), `secondary` (quiet, the common status chip), `destructive` (white on `destructive`, 60% in dark), `outline` (border only, `text-foreground`). Rendered as a link (`asChild` with `<a>`), hover darkens the fill.

**Do:** keep text sentence case ("On deck", "In progress"); let the word carry the meaning.
**Don't:** use a badge as a button, invent new colored variants, or rely on color alone for status.
