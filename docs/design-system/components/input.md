# Input

The single-line text field, plus `Textarea`, `Label` and `FormLabel`. From `apps/internal/components/ui/input.tsx`, `textarea.tsx`, `@pts/ui/label`, `components/ui/form.tsx`.

**Look:** `h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-xs`, `text-base` below md and `md:text-sm` (keeps iOS from zooming); dark adds `bg-input/30`. Placeholder `muted-foreground`. Focus `border-ring` + 3px `ring-ring/50`. Invalid (`aria-invalid`) swaps to `border-destructive` + `ring-destructive/20` (dark /40). Disabled `opacity-50`. Textarea: `min-h-16 px-3 py-2 field-sizing-content`.

**Consumer provides:** a `Label`/`FormLabel` (`text-sm font-medium leading-none`), the value, and validation via React Hook Form + Zod; `FormMessage` shows the error in `destructive`.

**Do**
- Mark optional fields with `<FormLabel optional>`, which appends a muted "(optional)".
- Keep helper copy out unless it changes a decision.
- Use `data-autofocus` on the field a sheet should focus first.

**Don't:** add per-field hint paragraphs, placeholders that repeat the label, or custom border colors.
