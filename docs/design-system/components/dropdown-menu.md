# DropdownMenu

The action menu behind "…" row buttons and toolbar triggers, on Base UI Menu. From `@pts/ui/dropdown-menu`.

**Parts:** `DropdownMenuTrigger` (usually an `outline` or `ghost` icon Button), `DropdownMenuContent` (`bg-popover border rounded-md p-1 shadow-md`, min-w-32), `DropdownMenuLabel` (text-sm font-medium), `DropdownMenuItem` (`variant="destructive"` for text in `destructive` with a `destructive/10` hover), `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuShortcut` (text-xs tracking-widest muted), `DropdownMenuSeparator`, `DropdownMenuSub*` (submenu content uses shadow-lg).

**Rules**
- Content is left-aligned (`align='start'` default). Never pass `align='start'`; pass an explicit `align` only for a real exception (e.g. `end` at the right edge).
- Every item carries paired `hover:` and `data-highlighted:` accent classes.
- Icons in items are 16px `muted-foreground`; destructive items tint their icon too.
- Put destructive items last, after a separator, and name the object ("Archive").
