# Select

A single-choice dropdown on Base UI Select with a Radix-shaped API (`onValueChange(value: string)`). From `@pts/ui/select`.

**Parts:** `Select`, `SelectTrigger` (`size="sm" | "default"`: h-8 / h-9), `SelectValue` (placeholder in `muted-foreground`), `SelectContent`, `SelectGroup`, `SelectLabel` (text-xs muted), `SelectItem`, `SelectSeparator`.

**Look:** trigger matches Input (border-input, shadow-xs, rounded-md, ChevronDown at 50%). Popup: `bg-popover border rounded-md shadow-md p-1`, at least the trigger's width. Items: `rounded-sm py-1.5 pl-2 pr-8 text-sm`, Check indicator on the right.

**Rules**
- The popup is left-aligned with its trigger by default (`align='start'` in the wrapper). Never pass `align='start'` at a call site; pass another `align` only when deviating on purpose. (guard: eslint `pts/no-align-start`)
- Items need `hover:bg-accent hover:text-accent-foreground` alongside `data-highlighted:` — Base UI doesn't set `data-highlighted` on plain mouse hover. The wrapper already does; keep both if you restyle. (guard: review)
- Inside a sheet, a Select change is a form value applied on Save, never an immediate mutation. (guard: review)
- For long or searchable lists use `SearchableCombobox` (`components/ui/searchable-combobox.tsx`). Its picked option has a check on the right; no row keeps a left gutter for it. List filters: `filter.md`. (guard: review)
- **A picker opens on its selection.** The selected option is scrolled into the middle of the list, checked, and highlighted, so arrows and Enter start there; a multi-select opens on its first ticked option. It happens once per open: scrolling and hovering afterwards are left alone, and typing a search highlights the top match. A hand-built cmdk picker gets this from `useRevealSelected` in `components/ui/command.tsx` (its list `ref`, plus the same value as the `Command`'s `defaultValue`). (guard: review)
- Every floating panel (this list, popovers, menus, date pickers) uses `shadow-popover`. (guard: review)
- **"When does this take effect" is `EffectiveMonthSelect`** (`components/billing/effective-month-select.tsx`): a tinted callout, title left, a `w-72` month select right, one optional note line. Billing starts/stops, billing type and commission changes, and a sign-in's role change all use it. Month labels come from `lib/billing/months.ts` (`monthLabel`, `monthLabelFromNow`, `currentMonthStartUtc`), counted in UTC like the server. (guard: review)
