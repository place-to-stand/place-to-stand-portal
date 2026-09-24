# Select

A single-choice dropdown on Base UI Select with a Radix-shaped API (`onValueChange(value: string)`). From `@pts/ui/select`.

**Parts:** `Select`, `SelectTrigger` (`size="sm" | "default"`: h-8 / h-9), `SelectValue` (placeholder in `muted-foreground`), `SelectContent`, `SelectGroup`, `SelectLabel` (text-xs muted), `SelectItem`, `SelectSeparator`.

**Look:** trigger matches Input (border-input, shadow-xs, rounded-md, ChevronDown at 50%). Popup: `bg-popover border rounded-md shadow-md p-1`, at least the trigger's width. Items: `rounded-sm py-1.5 pl-2 pr-8 text-sm`, Check indicator on the right.

**Rules**
- The popup is left-aligned with its trigger by default (`align='start'` in the wrapper). Never pass `align='start'` at a call site; pass another `align` only when deviating on purpose.
- Items need `hover:bg-accent hover:text-accent-foreground` alongside `data-highlighted:` — Base UI doesn't set `data-highlighted` on plain mouse hover. The wrapper already does; keep both if you restyle.
- Inside a sheet, a Select change is a form value applied on Save, never an immediate mutation.
- For long or searchable lists use `SearchableCombobox` (`components/ui/searchable-combobox.tsx`).
