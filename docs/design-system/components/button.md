# Button

The action control: six variants, seven sizes, a 2px (`gap-2`) icon gap built in. From `@pts/ui/button` (`packages/ui/src/button.tsx`).

**Consumer provides:** a label (sentence case, verb first) and optionally a lucide icon as the first child; `variant`, `size`, `asChild` to render a link.

**Variants** (`variant`)
- `default`: `bg-primary text-primary-foreground hover:bg-primary/90`. One per view, for the thing the view is for.
- `secondary`: `bg-secondary text-secondary-foreground`.
- `outline`: `border bg-background shadow-xs`, dark `bg-input/30 border-input`. Toolbars, secondary actions beside a primary.
- `ghost`: transparent, `hover:bg-accent`. Row actions, Cancel/Discard.
- `destructive`: `bg-destructive text-white`, dark `bg-destructive/60`. Always names what it destroys ("Archive client").
- `link`: `text-primary underline-offset-4 hover:underline`.

**Sizes** (`size`): `xs` h-7 text-xs · `sm` h-8 · `default` h-9 px-4 · `lg` h-10 px-6 · `icon` size-9 · `icon-sm` size-7 with 14px glyph (table row actions) · `icon-lg` size-10. With a leading svg, padding tightens (`has-[>svg]:px-3`).

**Do**
- Put the icon first and let `gap-2` space it: `<Button><Plus />Add lead</Button>`.
- Give icon-only buttons an `aria-label`.
- In sheets, keep Save enabled; disable only while the save is in flight ("Saving…") or when a real validation precondition fails.

**Don't**
- Add `mr-*`/`ml-*` to an icon inside a Button.
- Gate Save on `isDirty`/has-changes.
- Use `brand-lime` or any hue other than `destructive` on a button.
