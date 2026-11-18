# Input

The single-line text field, plus `Textarea`, `Label` and `FormLabel`. From `@pts/ui/input`, `@pts/ui/textarea`, `@pts/ui/label`, `components/ui/form.tsx`.

**Look:** `h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-xs`, `text-base` below md and `md:text-sm` (keeps iOS from zooming); dark adds `bg-input/30`. Placeholder `muted-foreground`. Focus `border-ring` + 3px `ring-ring/50`. Invalid (`aria-invalid`) swaps to `border-destructive` + `ring-destructive/20` (dark /40). Disabled `opacity-50`. Textarea: `min-h-16 px-3 py-2 field-sizing-content`.

**Consumer provides:** a `Label`/`FormLabel` (`text-sm font-medium leading-none`), the value, and validation via React Hook Form + Zod; `FormMessage` shows the error in `destructive`.

**Do**

- Mark optional fields with `<FormLabel optional>`, which appends a muted "(optional)".
- Keep helper copy out unless it changes a decision.
- Use `data-autofocus` on the field a sheet should focus first.

**Don't:** add per-field hint paragraphs, placeholders that repeat the label, or custom border colors.

**Image fields:** every image upload (a person's photo, the business logo and icon) is `ImageUploadControls` (`components/forms/image-upload-controls.tsx`), and the preview tile is the control: no row of buttons beside it. All three are one family, every tile 64px tall: `circle` (64px, a person's photo, filled edge to edge), `square` (64px, an icon) and `wide` (192×64, a logo), the last two `rounded-md` with the image contained at the same 8px inset. The tile is a real button: click, Enter or Space opens the file picker, and dropping one image file on it does the same (the border turns `primary` while a file is over it; drop is an extra, never the only way). Empty, it is a transparent tile with a dashed 1px border (`muted-foreground` at 40%, so it shows in light mode too) and the muted image-plus icon centred, no words, going `primary` on hover. Filled, the border is solid; hover or keyboard focus lays the same dark layer with the image-plus icon over all three, clipped to the tile's shape, and the focus ring follows the shape. Its accessible name says the action ("Upload logo", "Replace photo"). A remove badge shows whenever there is an image (not only on hover, so touch works): a solid round × (`RowActionButton` `icon-xs`: a 20px circle, 12px glyph, a 28px invisible hit area; opaque `bg-background` with a `border` and `shadow-sm` in both themes, red `destructive` on hover or focus, "Remove <noun>") on the tile's top-right corner, or on a photo circle's edge at 45°, hidden while uploading or disabled. While uploading, a spinner covers the tile and it is disabled. The label sits 8px above the tile and one muted `text-xs` hint 8px below it, naming the size and file types in one style ("Wide image up to 256 KB. PNG, JPEG, WEBP or SVG."; a photo's says "shown in a circle"); a field error follows in `destructive`. `DisabledFieldTooltip` explains a locked tile. The caller decides where the file goes. (guard: review)
