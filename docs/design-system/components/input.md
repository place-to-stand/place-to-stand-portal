# Input

The single-line text field, plus `Textarea`, `Label` and `FormLabel`. From `@pts/ui/input`, `@pts/ui/textarea`, `@pts/ui/label`, `components/ui/form.tsx`.

**Look:** `h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-xs`, `text-base` below md and `md:text-sm` (keeps iOS from zooming); dark adds `bg-input/30`. Placeholder `muted-foreground`. Focus `border-ring` + 3px `ring-ring/50`. Invalid (`aria-invalid`) swaps to `border-destructive` + `ring-destructive/20` (dark /40). Disabled `opacity-50`. Textarea: `min-h-16 px-3 py-2 field-sizing-content`.

**Consumer provides:** a `Label`/`FormLabel` (`text-sm font-medium leading-none`), the value, and validation via React Hook Form + Zod; `FormMessage` shows the error in `destructive`.

**Do**

- Mark optional fields with `<FormLabel optional>`, which appends a muted "(optional)".
- Keep helper copy out unless it changes a decision.
- Use `data-autofocus` on the field a sheet should focus first.

**Don't:** add per-field hint paragraphs, placeholders that repeat the label, or custom border colors.

**Image fields:** every image upload (a person's photo, the business logo and icon) is `ImageUploadControls` (`components/forms/image-upload-controls.tsx`), and the preview tile is the control: no row of buttons beside it. All three are one family, every tile 64px tall: `circle` (64px, a person's photo, filled edge to edge), `square` (64px, an icon) and `wide` (192×64, a logo), the last two in one standard frame, empty or filled: a `rounded-lg` box with a 1px border, a `bg-muted/40` fill and an 8px inset, the image contained in it. The tile is a real button: click, Enter or Space opens the file picker, and dropping one image file on it does the same (the border turns `primary` while a file is over it; drop is an extra, never the only way). Empty, the frame (or the photo circle) has a dashed 1px border (`muted-foreground` at 40%, so it shows in light mode too) and the muted image-plus icon centred, no words, and nothing in its corner. Nothing is ever drawn over an image: hover darkens the border (`foreground/30`), keyboard focus shows the input's ring following the tile's shape, and a file dragged over it turns the border dashed `primary` on a `primary/5` wash. Its accessible name says the action ("Upload logo", "Replace photo"). With an image, an edit button sits beside the tile (8px to its right, centred on it; nothing ever overlaps a frame or a photo): the standard outline `RowActionButton` (`icon-sm`) with a pencil, "Edit logo" / "Edit photo", a menu trigger (`tooltip={false}`) opening the shared `DropdownMenu` with "Replace…" and "Remove" (destructive). It hides while uploading or disabled. While uploading, a small spinner sits at the tile's centre (the only thing ever drawn over the image) and it is disabled. The label sits 8px above the tile and one muted `text-xs` hint 8px below it, naming the size and file types in one style ("Wide image up to 256 KB. PNG, JPEG, WEBP or SVG."; a photo's says "shown in a circle"); a field error follows in `destructive`. `DisabledFieldTooltip` explains a locked tile. The caller decides where the file goes. A hand-made `<input type="file">` that accepts images is a lint error. (guard: lint `pts/restricted-syntax`)
