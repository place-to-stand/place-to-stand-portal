# Input

The single-line text field, plus `Textarea`, `Label` and `FormLabel`. From `@pts/ui/input`, `@pts/ui/textarea`, `@pts/ui/label`, `components/ui/form.tsx`.

**Look:** `h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-xs`, `text-base` below md and `md:text-sm` (keeps iOS from zooming); dark adds `bg-input/30`. Placeholder `muted-foreground`. Focus `border-ring` + 3px `ring-ring/50`. Invalid (`aria-invalid`) swaps to `border-destructive` + `ring-destructive/20` (dark /40). Disabled `opacity-50`. Textarea: `min-h-16 px-3 py-2 field-sizing-content`.

**Consumer provides:** a `Label`/`FormLabel` (`text-sm font-medium leading-none`), the value, and validation via React Hook Form + Zod; `FormMessage` shows the error in `destructive`.

**Do**

- Mark optional fields with `<FormLabel optional>`, which appends a muted "(optional)".
- Keep helper copy out unless it changes a decision.
- Use `data-autofocus` on the field a sheet should focus first.

**Don't:** add per-field hint paragraphs, placeholders that repeat the label, or custom border colors.

**Image fields:** every image upload (a person's photo, the business logo and icon) is `ImageUploadControls` (`components/forms/image-upload-controls.tsx`), and the preview tile is the control: no row of buttons beside it. `shape` sets the tile: `circle` (64px, a person's photo), `square` (64px, an icon) or `wide` (160×64, a logo). The tile is a real button: click, Enter or Space opens the file picker, and dropping one image file on it does the same (the border turns `primary` while a file is over it; drop is an extra, never the only way). Empty, it is a dashed `border` box with the image-plus icon and "Upload" ("Upload logo" in the wide tile), going `primary` on hover. With an image, hover or keyboard focus lays a dark overlay reading "Replace", and a round × (`RowActionButton`, outline, "Remove <noun>") sits on the tile's top-right corner, hidden while locked. While uploading, a spinner covers the tile and it is disabled. Under the tile, one muted `text-xs` line names the size and file types, and a field error follows it in `destructive`. Its accessible name says the action ("Upload logo", "Replace photo"), its focus ring is the input's, and `DisabledFieldTooltip` explains it when locked. The caller decides where the file goes. (guard: review)
